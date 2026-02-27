package botrunner

// bot.go — unified Telegram bot logic.
// A single bot type handles both "files" and "links" scenarios:
//   - if the bot has document assets in MinIO → sends them after subscription;
//   - otherwise → sends success_msg (with links or any MarkdownV2 text).

import (
	"context"
	"fmt"
	"log"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"

	"bot-manager/internal/db"
	"bot-manager/internal/storage"
)

// normalizeText replaces literal \n escape sequences with real newlines.
// Users often type \n in text fields expecting line breaks.
func normalizeText(s string) string {
	return strings.ReplaceAll(s, `\n`, "\n")
}

// sendMsg tries MarkdownV2; on parse error retries as plain text.
func sendMsg(bot *tgbotapi.BotAPI, logger *log.Logger, msg tgbotapi.MessageConfig) {
	msg.Text = normalizeText(msg.Text)
	msg.ParseMode = tgbotapi.ModeMarkdownV2
	if _, err := bot.Send(msg); err != nil {
		if strings.Contains(err.Error(), "can't parse entities") {
			logger.Printf("MarkdownV2 parse error (отправляю как plain text): %v\nПроверьте текст сообщения — спецсимволы (! . - + = | { } ( ) # > ~ `) должны быть экранированы или используйте кнопку «MD → TG» в интерфейсе.", err)
			msg.ParseMode = ""
			if _, err2 := bot.Send(msg); err2 != nil {
				logger.Printf("send message: %v", err2)
			}
		} else {
			logger.Printf("send message: %v", err)
		}
	}
}

func runBot(ctx context.Context, cfg db.Bot, store *storage.MinioStore, logger *log.Logger) error {
	bot, err := tgbotapi.NewBotAPI(cfg.Token)
	if err != nil {
		return fmt.Errorf("auth: %w", err)
	}
	logger.Printf("Авторизован под @%s", bot.Self.UserName)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	for {
		select {
		case <-ctx.Done():
			bot.StopReceivingUpdates()
			return nil
		case update, ok := <-updates:
			if !ok {
				return fmt.Errorf("updates channel closed")
			}
			handleBotUpdate(ctx, bot, cfg, store, logger, update)
		}
	}
}

func handleBotUpdate(
	ctx context.Context,
	bot *tgbotapi.BotAPI,
	cfg db.Bot,
	store *storage.MinioStore,
	logger *log.Logger,
	update tgbotapi.Update,
) {
	// Ignore group/supergroup messages.
	if update.Message != nil && update.Message.Chat.IsGroup() {
		return
	}

	if update.Message != nil && update.Message.Command() == "start" {
		sendWelcome(ctx, bot, cfg, store, logger, update.Message.Chat.ID)
		return
	}

	if update.CallbackQuery != nil && update.CallbackQuery.Data == "check_subscription" {
		chatID := update.CallbackQuery.Message.Chat.ID
		userID := update.CallbackQuery.From.ID

		// Acknowledge the callback immediately so Telegram removes the "loading" spinner.
		bot.Request(tgbotapi.NewCallback(update.CallbackQuery.ID, "")) //nolint:errcheck

		member, err := bot.GetChatMember(tgbotapi.GetChatMemberConfig{
			ChatConfigWithUser: tgbotapi.ChatConfigWithUser{
				ChatID: cfg.ChannelID,
				UserID: userID,
			},
		})
		if err != nil {
			logger.Printf("GetChatMember error: %v", err)
			return
		}

		if member.Status == "left" || member.Status == "kicked" {
			sendNotSub(bot, cfg, logger, chatID)
			return
		}

		sendSuccess(ctx, bot, cfg, store, logger, chatID)
	}
}

// sendWelcome sends the welcome message with an optional image.
// Falls back to a text message if the image cannot be fetched/sent.
func sendWelcome(
	ctx context.Context,
	bot *tgbotapi.BotAPI,
	cfg db.Bot,
	store *storage.MinioStore,
	logger *log.Logger,
	chatID int64,
) {
	kb := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData(cfg.ButtonText, "check_subscription"),
		),
	)

	if cfg.WelcomeImgKey != "" {
		rc, _, err := store.GetObject(ctx, cfg.WelcomeImgKey)
		if err == nil {
			photo := tgbotapi.NewPhoto(chatID, tgbotapi.FileReader{
				Name:   "welcome.jpg",
				Reader: rc,
			})
			photo.Caption = normalizeText(cfg.WelcomeMsg)
			photo.ParseMode = tgbotapi.ModeMarkdownV2
			photo.ReplyMarkup = kb
			_, sendErr := bot.Send(photo)
			rc.Close()
			if sendErr == nil {
				return
			}
			// Parse error — retry photo without parse mode.
			if strings.Contains(sendErr.Error(), "can't parse entities") {
				rc2, _, err2 := store.GetObject(ctx, cfg.WelcomeImgKey)
				if err2 == nil {
					photo2 := tgbotapi.NewPhoto(chatID, tgbotapi.FileReader{
						Name:   "welcome.jpg",
						Reader: rc2,
					})
					photo2.Caption = cfg.WelcomeMsg
					photo2.ReplyMarkup = kb
					_, sendErr2 := bot.Send(photo2)
					rc2.Close()
					if sendErr2 == nil {
						return
					}
					logger.Printf("send photo (plain): %v — fallback to text", sendErr2)
				}
			} else {
				logger.Printf("send photo: %v — fallback to text", sendErr)
			}
		}
	}

	msg := tgbotapi.NewMessage(chatID, cfg.WelcomeMsg)
	msg.ReplyMarkup = kb
	sendMsg(bot, logger, msg)
}

// sendNotSub informs the user they need to subscribe first.
func sendNotSub(bot *tgbotapi.BotAPI, cfg db.Bot, logger *log.Logger, chatID int64) {
	kb := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData(cfg.ButtonText, "check_subscription"),
		),
	)
	msg := tgbotapi.NewMessage(chatID, cfg.NotSubMsg)
	msg.ReplyMarkup = kb
	sendMsg(bot, logger, msg)
}

// sendSuccess delivers content to a verified subscriber.
// If the bot has document assets in MinIO, they are sent as files.
// Otherwise, success_msg (which may contain Markdown links) is sent.
func sendSuccess(
	ctx context.Context,
	bot *tgbotapi.BotAPI,
	cfg db.Bot,
	store *storage.MinioStore,
	logger *log.Logger,
	chatID int64,
) {
	prefix := fmt.Sprintf("%s/docs/", cfg.ID)
	objects, err := store.ListObjects(ctx, prefix)
	if err != nil {
		logger.Printf("list docs: %v", err)
		objects = nil
	}

	// If there are no files, fall back to success_msg (link-mode behaviour).
	if len(objects) == 0 {
		if cfg.SuccessMsg != "" {
			sendMsg(bot, logger, tgbotapi.NewMessage(chatID, cfg.SuccessMsg))
		}
		return
	}

	// Has files — send optional success_msg first, then each document.
	if cfg.SuccessMsg != "" {
		sendMsg(bot, logger, tgbotapi.NewMessage(chatID, cfg.SuccessMsg))
	}

	for _, obj := range objects {
		rc, _, err := store.GetObject(ctx, obj.Key)
		if err != nil {
			logger.Printf("get object %s: %v", obj.Key, err)
			continue
		}

		parts := strings.Split(obj.Key, "/")
		filename := parts[len(parts)-1]

		doc := tgbotapi.NewDocument(chatID, tgbotapi.FileReader{
			Name:   filename,
			Reader: rc,
		})
		if _, err := bot.Send(doc); err != nil {
			logger.Printf("send document %s: %v", filename, err)
		}
		rc.Close()
	}
}

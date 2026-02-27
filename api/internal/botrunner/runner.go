package botrunner

import (
	"context"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"bot-manager/internal/db"
	"bot-manager/internal/storage"
)

type BotStatus string

const (
	StatusStopped  BotStatus = "stopped"
	StatusStarting BotStatus = "starting"
	StatusRunning  BotStatus = "running"
	StatusError    BotStatus = "error"
)

// BotRunner owns a single bot goroutine and its associated log buffer.
type BotRunner struct {
	Cfg   db.Bot
	Logs  *RingBuffer
	store *storage.MinioStore

	mu        sync.RWMutex
	status    BotStatus
	statusMsg string
	cancel    context.CancelFunc
	done      chan struct{}
}

func New(cfg db.Bot, store *storage.MinioStore) *BotRunner {
	return &BotRunner{
		Cfg:    cfg,
		Logs:   NewRingBuffer(),
		store:  store,
		status: StatusStopped,
	}
}

func (r *BotRunner) Start() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.status != StatusStopped && r.status != StatusError {
		return fmt.Errorf("bot is already %s", r.status)
	}
	ctx, cancel := context.WithCancel(context.Background())
	r.cancel = cancel
	r.done = make(chan struct{})
	r.setStatusLocked(StatusStarting, "")
	go r.run(ctx)
	return nil
}

func (r *BotRunner) Stop() error {
	r.mu.Lock()
	if r.status == StatusStopped {
		r.mu.Unlock()
		return nil
	}
	cancel := r.cancel
	done := r.done
	r.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if done != nil {
		select {
		case <-done:
		case <-time.After(70 * time.Second):
		}
	}
	return nil
}

func (r *BotRunner) Status() BotStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.status
}

func (r *BotRunner) StatusMsg() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.statusMsg
}

func (r *BotRunner) UpdateConfig(cfg db.Bot) {
	r.mu.Lock()
	r.Cfg = cfg
	r.mu.Unlock()
}

func (r *BotRunner) run(ctx context.Context) {
	defer close(r.done)
	logger := r.botLogger()

	for {
		r.setStatus(StatusRunning, "")
		err := runBot(ctx, r.Cfg, r.store, logger)

		if ctx.Err() != nil {
			r.setStatus(StatusStopped, "")
			return
		}

		errMsg := ""
		if err != nil {
			errMsg = err.Error()
		}
		r.setStatus(StatusError, errMsg)
		logger.Printf("Бот упал: %v. Перезапуск через 10 сек...", err)

		select {
		case <-ctx.Done():
			r.setStatus(StatusStopped, "")
			return
		case <-time.After(10 * time.Second):
		}
	}
}

func (r *BotRunner) setStatus(s BotStatus, msg string) {
	r.mu.Lock()
	r.setStatusLocked(s, msg)
	r.mu.Unlock()
}

func (r *BotRunner) setStatusLocked(s BotStatus, msg string) {
	r.status = s
	r.statusMsg = msg
}

type ringWriter struct{ buf *RingBuffer }

func (w *ringWriter) Write(p []byte) (n int, err error) {
	w.buf.Write(string(p))
	return len(p), nil
}

func (r *BotRunner) botLogger() *log.Logger {
	return log.New(
		io.MultiWriter(&ringWriter{r.Logs}, log.Writer()),
		fmt.Sprintf("[%s] ", r.Cfg.ID),
		log.LstdFlags,
	)
}

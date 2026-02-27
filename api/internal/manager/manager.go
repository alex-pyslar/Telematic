package manager

import (
	"context"
	"fmt"
	"log"
	"sync"

	"bot-manager/internal/botrunner"
	"bot-manager/internal/db"
	"bot-manager/internal/storage"
)

type BotStatusSnapshot struct {
	ID        string              `json:"id"`
	Name      string              `json:"name"`
	Type      db.BotType          `json:"type"`
	Status    botrunner.BotStatus `json:"status"`
	StatusMsg string              `json:"status_msg"`
	Enabled   bool                `json:"enabled"`
}

type Manager struct {
	database *db.DB
	store    *storage.MinioStore
	runners  map[string]*botrunner.BotRunner
	mu       sync.Mutex
}

func New(database *db.DB, store *storage.MinioStore) *Manager {
	return &Manager{
		database: database,
		store:    store,
		runners:  make(map[string]*botrunner.BotRunner),
	}
}

// StartAll loads all bots from DB and starts enabled ones.
func (m *Manager) StartAll(ctx context.Context) {
	bots, err := m.database.GetAllBots(ctx)
	if err != nil {
		log.Printf("manager: load bots: %v", err)
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for _, cfg := range bots {
		r := botrunner.New(cfg, m.store)
		m.runners[cfg.ID] = r
		if cfg.Enabled {
			if err := r.Start(); err != nil {
				log.Printf("manager: start %s: %v", cfg.ID, err)
			}
		}
	}
}

func (m *Manager) StopAll() {
	m.mu.Lock()
	runners := make([]*botrunner.BotRunner, 0, len(m.runners))
	for _, r := range m.runners {
		runners = append(runners, r)
	}
	m.mu.Unlock()

	var wg sync.WaitGroup
	for _, r := range runners {
		wg.Add(1)
		go func(r *botrunner.BotRunner) {
			defer wg.Done()
			r.Stop()
		}(r)
	}
	wg.Wait()
}

func (m *Manager) Start(id string) error {
	m.mu.Lock()
	r, ok := m.runners[id]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("bot %q not found", id)
	}
	return r.Start()
}

func (m *Manager) Stop(id string) error {
	m.mu.Lock()
	r, ok := m.runners[id]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("bot %q not found", id)
	}
	return r.Stop()
}

func (m *Manager) Restart(id string) error {
	if err := m.Stop(id); err != nil {
		return err
	}
	return m.Start(id)
}

func (m *Manager) AddBot(ctx context.Context, cfg db.Bot) error {
	if err := m.database.UpsertBot(ctx, cfg); err != nil {
		return err
	}
	m.mu.Lock()
	if _, exists := m.runners[cfg.ID]; !exists {
		m.runners[cfg.ID] = botrunner.New(cfg, m.store)
	}
	m.mu.Unlock()
	return nil
}

func (m *Manager) UpdateBot(ctx context.Context, cfg db.Bot) error {
	m.mu.Lock()
	r, exists := m.runners[cfg.ID]
	m.mu.Unlock()

	wasRunning := exists && (r.Status() == botrunner.StatusRunning || r.Status() == botrunner.StatusStarting)
	if wasRunning {
		r.Stop()
	}

	if err := m.database.UpsertBot(ctx, cfg); err != nil {
		return err
	}

	m.mu.Lock()
	if exists {
		r.UpdateConfig(cfg)
	} else {
		r = botrunner.New(cfg, m.store)
		m.runners[cfg.ID] = r
	}
	m.mu.Unlock()

	if wasRunning {
		return r.Start()
	}
	return nil
}

func (m *Manager) DeleteBot(ctx context.Context, id string) error {
	m.mu.Lock()
	r, ok := m.runners[id]
	m.mu.Unlock()

	if ok {
		r.Stop()
	}

	if err := m.database.DeleteBot(ctx, id); err != nil {
		return err
	}

	m.mu.Lock()
	delete(m.runners, id)
	m.mu.Unlock()
	return nil
}

func (m *Manager) Status() []BotStatusSnapshot {
	m.mu.Lock()
	defer m.mu.Unlock()

	out := make([]BotStatusSnapshot, 0, len(m.runners))
	for _, r := range m.runners {
		out = append(out, BotStatusSnapshot{
			ID:        r.Cfg.ID,
			Name:      r.Cfg.Name,
			Type:      r.Cfg.Type,
			Status:    r.Status(),
			StatusMsg: r.StatusMsg(),
			Enabled:   r.Cfg.Enabled,
		})
	}
	return out
}

func (m *Manager) Logs(id string) ([]string, error) {
	m.mu.Lock()
	r, ok := m.runners[id]
	m.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("bot %q not found", id)
	}
	return r.Logs.Lines(), nil
}

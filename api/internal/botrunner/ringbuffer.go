package botrunner

import "sync"

const ringBufferSize = 200

// RingBuffer is a thread-safe fixed-capacity ring buffer of strings.
type RingBuffer struct {
	mu   sync.Mutex
	buf  [ringBufferSize]string
	pos  int // next write position
	size int // number of entries stored (0..ringBufferSize)
}

func NewRingBuffer() *RingBuffer { return &RingBuffer{} }

func (r *RingBuffer) Write(line string) {
	r.mu.Lock()
	r.buf[r.pos%ringBufferSize] = line
	r.pos++
	if r.size < ringBufferSize {
		r.size++
	}
	r.mu.Unlock()
}

// Lines returns all stored lines in insertion order (oldest first).
func (r *RingBuffer) Lines() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.size == 0 {
		return nil
	}
	out := make([]string, r.size)
	start := (r.pos - r.size + ringBufferSize*2) % ringBufferSize
	for i := 0; i < r.size; i++ {
		out[i] = r.buf[(start+i)%ringBufferSize]
	}
	return out
}

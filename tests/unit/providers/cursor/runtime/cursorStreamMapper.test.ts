import { CursorNdjsonStreamReducer } from '@/providers/cursor/runtime/cursorStreamMapper';

describe('CursorNdjsonStreamReducer', () => {
  it('emits text deltas for cumulative assistant output when timestamp_ms is absent (legacy / 整段)', () => {
    const r = new CursorNdjsonStreamReducer();
    const a = r.reduceLine(JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'hel' }] },
      session_id: 's1',
    }));
    expect(a.chunks).toEqual([{ type: 'text', content: 'hel' }]);
    expect(a.sessionId).toBe('s1');

    const b = r.reduceLine(JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
      session_id: 's1',
    }));
    expect(b.chunks).toEqual([{ type: 'text', content: 'lo' }]);
  });

  it('stream-partial-output: emits incremental text when timestamp_ms present and model_call_id absent', () => {
    const r = new CursorNdjsonStreamReducer();
    const a = r.reduceLine(JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'hel' }] },
      session_id: 's1',
      timestamp_ms: 1,
    }));
    expect(a.chunks).toEqual([{ type: 'text', content: 'hel' }]);

    const b = r.reduceLine(JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'lo' }] },
      session_id: 's1',
      timestamp_ms: 2,
    }));
    expect(b.chunks).toEqual([{ type: 'text', content: 'lo' }]);
  });

  it('stream-partial-output: skips assistant lines with both timestamp_ms and model_call_id (buffer duplicate)', () => {
    const r = new CursorNdjsonStreamReducer();
    const out = r.reduceLine(JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'duplicate flush' }] },
      session_id: 's1',
      timestamp_ms: 1,
      model_call_id: 'mc1',
    }));
    expect(out.chunks).toEqual([]);
  });

  it('skips assistant line when content equals accumulated (duplicate final flush without timestamps)', () => {
    const r = new CursorNdjsonStreamReducer();
    r.reduceLine(JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'same' }] },
      session_id: 's1',
    }));
    const dup = r.reduceLine(JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'same' }] },
      session_id: 's1',
    }));
    expect(dup.chunks).toEqual([]);
  });

  it('emits tool_use on started and tool_result on completed', () => {
    const r = new CursorNdjsonStreamReducer();
    const start = r.reduceLine(JSON.stringify({
      type: 'tool_call',
      subtype: 'started',
      call_id: 'c1',
      tool_call: { readToolCall: { args: { path: 'a.md' } } },
    }));
    expect(start.chunks).toEqual([{
      type: 'tool_use',
      id: 'c1',
      name: 'read_file',
      input: { path: 'a.md' },
    }]);

    const done = r.reduceLine(JSON.stringify({
      type: 'tool_call',
      subtype: 'completed',
      call_id: 'c1',
      tool_call: { readToolCall: { args: { path: 'a.md' }, result: { success: { content: 'x' } } } },
    }));
    expect(done.chunks[0]).toMatchObject({
      type: 'tool_result',
      id: 'c1',
      content: expect.stringContaining('readToolCall'),
    });
  });

  it('ends with usage and done on result success', () => {
    const r = new CursorNdjsonStreamReducer();
    const out = r.reduceLine(JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: 's9',
    }));
    expect(out.chunks.map(c => c.type)).toEqual(['usage', 'done']);
  });
});

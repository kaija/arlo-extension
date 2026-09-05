/*
 * PARKED — the content-script case from tests/messages.test.ts.
 * Restore with parked/shared/content-messages.ts and the sendToContent helper.
 */

  it('turns a missing content script into a failed response, not a throw', async () => {
    Object.assign(chrome, {
      tabs: {
        sendMessage: vi.fn(async () => {
          throw new Error('Could not establish connection.');
        }),
      },
    });

    const response = await sendToContent(3, { type: 'content:ping' });
    expect(response).toEqual({ ok: false, error: 'Could not establish connection.' });
  });

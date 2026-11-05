import { getDisplayAttachments } from '../templateAttachments';

describe('template document display', () => {
  const additionalAttributes = {
    templateParams: {
      processedParams: {
        header: {
          mediaType: 'document',
          mediaUrl: 'https://files.example.com/boletos/123',
          mediaName: 'boleto.pdf',
        },
      },
    },
  };

  it('exposes the stored template document as a downloadable file without mutating the message', () => {
    const attachments = [];
    const result = getDisplayAttachments(attachments, additionalAttributes);
    expect(result).toEqual([
      {
        id: 'template-document',
        fileType: 'file',
        dataUrl: 'https://files.example.com/boletos/123',
        fileName: 'boleto.pdf',
      },
    ]);
    expect(attachments).toEqual([]);
  });

  it('does not duplicate a document already present as an attachment', () => {
    const attachments = [
      { fileType: 'file', dataUrl: 'https://files.example.com/boletos/123' },
    ];
    expect(getDisplayAttachments(attachments, additionalAttributes)).toBe(
      attachments
    );
  });

  it('preserves normal messages and templates without a document URL', () => {
    const attachments = [
      { fileType: 'image', dataUrl: 'https://files.example.com/image.png' },
    ];
    expect(getDisplayAttachments(attachments, {})).toBe(attachments);
    expect(
      getDisplayAttachments(attachments, {
        templateParams: {
          processedParams: { header: { mediaType: 'document' } },
        },
      })
    ).toBe(attachments);
  });
});

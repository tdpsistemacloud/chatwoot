import { ATTACHMENT_TYPES } from './constants';

// Pending outgoing text messages carry `attachments: null` until the server echoes them back.
export const getDisplayAttachments = (attachments, additionalAttributes) => {
  const messageAttachments = attachments || [];
  const header = additionalAttributes.templateParams?.processedParams?.header;
  if (
    header?.mediaType?.toLowerCase() !== 'document' ||
    !header.mediaUrl ||
    messageAttachments.some(
      attachment => attachment.dataUrl === header.mediaUrl
    )
  ) {
    return messageAttachments;
  }

  return [
    ...messageAttachments,
    {
      id: 'template-document',
      fileType: ATTACHMENT_TYPES.FILE,
      dataUrl: header.mediaUrl,
      fileName: header.mediaName,
    },
  ];
};

import { ATTACHMENT_TYPES } from './constants';

export const getDisplayAttachments = (attachments, additionalAttributes) => {
  const header = additionalAttributes.templateParams?.processedParams?.header;
  if (
    header?.mediaType?.toLowerCase() !== 'document' ||
    !header.mediaUrl ||
    attachments.some(attachment => attachment.dataUrl === header.mediaUrl)
  ) {
    return attachments;
  }

  return [
    ...attachments,
    {
      id: 'template-document',
      fileType: ATTACHMENT_TYPES.FILE,
      dataUrl: header.mediaUrl,
      fileName: header.mediaName,
    },
  ];
};

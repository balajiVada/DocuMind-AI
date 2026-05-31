import { useEffect } from 'react';
import { useDocumentsStore } from '../stores/useDocumentsStore';

export const useDocumentPolling = (pollingInterval = 3000) => {
  const { documents, fetchDocuments } = useDocumentsStore();

  useEffect(() => {
    // Check if any documents are currently in a processing state
    const isProcessing = documents.some(
      (doc) => doc.status === 'QUEUED' || doc.status === 'PROCESSING' || doc.status === 'UPLOADING'
    );

    if (!isProcessing) {
      return; // Stop polling if everything is complete
    }

    const intervalId = setInterval(() => {
      // Background fetch without setting isLoading to true (prevents flicker)
      fetchDocuments();
    }, pollingInterval);

    // Cleanup interval on unmount or when dependencies change
    return () => clearInterval(intervalId);
  }, [documents, fetchDocuments, pollingInterval]);
};

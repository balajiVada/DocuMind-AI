# Phase 1 Implementation Plan: Core RAG Foundation

This document outlines the Low-Level Design (LLD), architecture, and technical specifications for Phase 1 of DocuMind-AI. This is a living document that will be updated as we progress.

## 1. Architecture Overview

### System Components
- **Frontend**: React (Vite) + TypeScript + Tailwind CSS.
- **Backend**: Node.js + Express + TypeScript.
- **Orchestration**: LangChain.js for managing the RAG pipeline.
- **Vector Database**: Pinecone (Serverless / Starter Plan).
- **Metadata Database**: MongoDB (for tracking document status and chat history).
- **LLM & Embeddings**: OpenAI (`gpt-4o` and `text-embedding-3-small`).

### Core Workflow (Phase 1)
1. **Ingestion**: File Upload → Text Extraction → Chunking → Embedding → Vector Store (Pinecone) + Metadata Store (MongoDB).
2. **Retrieval**: User Query → Embedding → Similarity Search (Pinecone) → Context Construction.
3. **Generation**: Prompt Template → LLM Completion (Streaming) → Source Citations UI.

---

## 2. Low-Level Design (LLD)

### 2.1 Proposed Folder Structure

```text
DocuMind-AI/
├── backend/
│   ├── src/
│   │   ├── config/             # DB & API configurations
│   │   ├── controllers/        # Request handlers (Upload, Chat)
│   │   ├── services/           # Business logic (RAG, Vector, Document Processing)
│   │   ├── models/             # MongoDB schemas
│   │   ├── routes/             # API routing
│   │   ├── utils/              # Helpers (File parsing, Chunking)
│   │   ├── middleware/         # Auth, Error handling, Multer
│   │   └── index.ts            # Entry point
│   ├── uploads/                # Temporary local storage for files
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/         # UI Components (Chat, Sidebar, Upload)
│   │   ├── services/           # API clients (Axios/Fetch)
│   │   ├── hooks/              # Custom React hooks (useChat, useUpload)
│   │   ├── types/              # TypeScript interfaces
│   │   ├── assets/             # Global styles and assets
│   │   └── App.tsx
│   └── .env
└── Docs/                       # Documentation and plans
```

### 2.2 Data Schemas

#### MongoDB (Metadata Store)
- **Document Collection**
  ```typescript
  {
    _id: ObjectId;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: 'processing' | 'indexed' | 'failed';
    uploadDate: Date;
    chunkCount: number;
    metadata: {
      author?: string;
      pageCount?: number;
    };
  }
  ```

#### Pinecone (Vector Store Metadata)
- **Vector Metadata Payload**
  ```typescript
  {
    text: string;           // The actual text chunk
    documentId: string;     // Reference to MongoDB Document _id
    fileName: string;       // For easy citation
    pageNumber: number;     // For page-level citation
    chunkIndex: number;     // Order of chunks
  }
  ```

### 2.3 API Endpoints

#### Document Management
- `POST /api/documents/upload`: Handles file upload (Multer), triggers extraction & embedding.
- `GET /api/documents`: Lists all uploaded documents and their statuses.
- `DELETE /api/documents/:id`: Deletes document from MongoDB and vectors from Pinecone.

#### Chat & Retrieval
- `POST /api/chat`: Receives a question, performs RAG, and returns a streaming response with citations.

---

## 3. Progress Tracking (Phase 1)

| Task | Status | Description |
| :--- | :--- | :--- |
| **Project Setup** | ✅ Completed | Init frontend, backend, and TS configs |
| **Infrastructure** | ✅ Completed | MongoDB connection & Pinecone initialization |
| **File Upload (1.1)** | ✅ Completed | Upload UI + Multer backend endpoint |
| **Processing (1.2)** | ✅ Completed | Text extraction logic (PDF/TXT) |
| **Vector Indexing (1.3)** | ✅ Completed | Chunking & embedding into Pinecone |
| **RAG Pipeline (1.4)** | ✅ Completed | Similarity search + LLM context |
| **Citations (1.5)** | ✅ Completed | Mapping vectors back to source metadata |
| **Chat UI (1.6)** | ✅ Completed | Streaming response interface |

---

## 4. Key Strategies

- **Chunking**: 1000 characters / 200 overlap (RecursiveCharacterTextSplitter).
- **Retrieval**: Top-K (6 chunks) with metadata filtering.
- **Streaming**: Server-Sent Events (SSE) for real-time chat.
- **UI Aesthetic**: Premium dark mode, glassmorphism, Lucide icons.

# RAG Pipeline Architecture

This document serves as the living architecture diagram for our Retrieval-Augmented Generation (RAG) pipeline. It outlines exactly what happens to your data from the moment a document is uploaded to the moment an AI response is generated.

This document has been updated to reflect the **Phase 2 Architecture**, which introduces enterprise-grade features like asynchronous ingestion, hybrid retrieval, and real-time observability.

---

## Phase 2 Architecture

### 1. Data Ingestion Pipeline (Upload)

When a user uploads a document, it goes through a resilient, asynchronous transformation process to become mathematically and textually searchable.

```mermaid
flowchart TD
    A[User Uploads Document\nPDF, DOCX, TXT, PPTX, CSV] --> H[Duplicate Detection\nSHA-256 Hashing];
    H -->|New File| Q[Async Ingestion Queue\nRedis + BullMQ];
    H -.->|Duplicate Found| R[Return Existing Metadata];
    
    Q --> B[Worker Process];
    B --> E[Text Extraction\npdf-parse, mammoth, xlsx];
    E --> C[Text Chunking\nRecursiveCharacterTextSplitter];
    
    C -->|Breaks into chunks| D[Chunk Deduplication];
    
    D -->|Parallel Processing| S[(Vector Database\nPinecone - Semantic Search)];
    D -->|Parallel Processing| M[(Document Database\nMongoDB - Keyword Search)];
    
    style A fill:#ffffff,stroke:#000000
    style Q fill:#fde68a,stroke:#d97706
    style B fill:#f1f5ff,stroke:#1863dc
    style E fill:#f1f5ff,stroke:#1863dc
    style C fill:#f1f5ff,stroke:#1863dc
    style S fill:#071829,stroke:#071829,color:#ffffff
    style M fill:#116e63,stroke:#116e63,color:#ffffff
```

**Step-by-Step Breakdown:**
1. **Duplicate Detection:** The uploaded file is hashed (SHA-256) to check if it already exists in the workspace. If it does, processing is skipped to save costs and avoid duplicate chunks.
2. **Queuing:** The file is pushed to a background Redis queue (managed by BullMQ). This ensures the frontend doesn't timeout while processing large files.
3. **Extraction & Chunking:** A background worker picks up the job, extracts text across various formats, and splits it into semantic chunks.
4. **Dual Storage:** The chunks are simultaneously embedded and stored in **Pinecone** for semantic vector search, and stored in **MongoDB** with a text index for exact keyword matching.

---

### 2. Retrieval & Generation Pipeline (Chat)

When a user asks a question, the system employs sliding-window memory, LLM-based query rewriting, and hybrid retrieval with Reciprocal Rank Fusion (RRF) to provide the most accurate answer possible.

```mermaid
flowchart TD
    Q[User Asks Question] --> M1[Sliding Window Memory\nFetches last 3 turns];
    M1 --> QR{Query Rewrite Heuristic};
    
    QR -->|Pronouns/Short| R_LLM[LLM Query Rewriter];
    QR -.->|Standalone Query| HR;
    R_LLM --> HR[Hybrid Retrieval Orchestrator];
    
    HR -->|Parallel| PS[(Semantic Search\nPinecone)];
    HR -->|Parallel| MS[(Keyword Search\nMongoDB)];
    
    PS --> F[Reciprocal Rank Fusion\nRRF Algorithm];
    MS --> F;
    
    F --> C[Context Assembly\nToken Estimation];
    Q -.-> C;
    
    C -->|Original Prompt + Context| L[LLM Generation\nAzure OpenAI];
    
    L -->|SSE Stream| O[AI Pipeline Inspector\nObservability Events];
    L -->|SSE Stream| A[User Receives Answer\nwith Citations];
    
    style Q fill:#ffffff,stroke:#000000
    style M1 fill:#f3e8ff,stroke:#7e22ce
    style R_LLM fill:#f3c9b6,stroke:#ff7759
    style HR fill:#f1f5ff,stroke:#1863dc
    style PS fill:#071829,stroke:#071829,color:#ffffff
    style MS fill:#116e63,stroke:#116e63,color:#ffffff
    style F fill:#dcfce7,stroke:#166534
    style L fill:#f3c9b6,stroke:#ff7759
    style O fill:#1e293b,stroke:#0f172a,color:#ffffff
```

**Step-by-Step Breakdown:**
1. **Memory & Rewriting:** We pull the last 6 messages (3 conversational turns) from MongoDB. If the user's question contains pronouns (e.g., "What about the second one?"), an LLM strictly rewrites it into a standalone query. If the query is already standalone, we hit a fast-path heuristic to skip the LLM rewrite step and save latency.
2. **Hybrid Retrieval:** The standalone query is sent to both Pinecone (for meaning-based search) and MongoDB (for exact keyword/BM25-style search) concurrently.
3. **Reciprocal Rank Fusion (RRF):** Because vector scores and keyword scores operate on totally different mathematical scales, we use RRF to merge and rerank the two lists of chunks into a single definitive context list.
4. **Context & Generation:** The fused context is compiled with the *original* query and system instructions to prevent the LLM from hallucinating based on the memory or rewritten query.
5. **Streaming & Observability:** The LLM begins streaming the final answer to the user. Concurrently, the backend emits structured `pipeline_step` events (e.g., `query_rewritten`, `semantic_search_completed`, `context_compiled`) down the same SSE stream, which powers the real-time **AI Pipeline Inspector** panel for developers.

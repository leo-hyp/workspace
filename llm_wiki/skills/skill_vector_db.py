import os
import chromadb
from chromadb.utils import embedding_functions

WORKSPACE = r"c:\Users\ismadmin\Documents\Workspace\llm_wiki"
DB_DIR = os.path.join(WORKSPACE, "chroma_db")

# Initialize ChromaDB persistent client
client = chromadb.PersistentClient(path=DB_DIR)

# Default embedding function
# Use multilingual embedding function for Korean support
default_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="paraphrase-multilingual-MiniLM-L12-v2"
)

def get_collection():
    return client.get_or_create_collection(
        name="wiki_knowledge_v3",
        embedding_function=default_ef
    )

def add_documents(texts, metadatas, ids):
    """
    텍스트 청크를 벡터화하여 DB에 추가합니다.
    texts: list of str
    metadatas: list of dict, e.g., [{"source": "file.pdf"}]
    ids: list of str, e.g., ["file.pdf_chunk1"]
    """
    if not texts:
        return
        
    collection = get_collection()
    collection.add(
        documents=texts,
        metadatas=metadatas,
        ids=ids
    )
    print(f"[VectorDB] {len(texts)} chunks added.")

def query_documents(query_text, n_results=5):
    """
    질의어와 의미상 가장 유사한 텍스트 청크를 검색합니다.
    """
    collection = get_collection()
    
    # Check if collection is empty
    if collection.count() == 0:
        return []
        
    # ChromaDB queries require a list of queries
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results
    )
    
    # Return the first result list of documents and metadatas
    if results and 'documents' in results and results['documents']:
        metadatas = results['metadatas'][0] if 'metadatas' in results and results['metadatas'] else []
        return results['documents'][0], metadatas
    return [], []

def delete_by_source(source_filename):
    """
    메타데이터에 지정된 source_filename과 일치하는 모든 벡터를 삭제합니다.
    """
    collection = get_collection()
    
    try:
        collection.delete(
            where={"source": source_filename}
        )
        print(f"[VectorDB] Deleted all vectors for source: {source_filename}")
        return True
    except Exception as e:
        print(f"[VectorDB] Error deleting source {source_filename}: {e}")
        return False

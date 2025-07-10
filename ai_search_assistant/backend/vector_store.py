from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from load_documents import load_documents

from dotenv import load_dotenv
import os

load_dotenv()

def create_faiss_index(folder_path="data/sample_docs"):
    documents = load_documents(folder_path)
    if not documents:
        print("⚠️ No documents found. Check your data/sample_docs folder.")
        return
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.from_documents(documents, embeddings)
    db.save_local("faiss_index")
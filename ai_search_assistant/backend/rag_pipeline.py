import google.generativeai as genai
import os
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.prompts import PromptTemplate
from dotenv import load_dotenv


# Load environment variables
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))  # Ensure your env var is correct
gemini = genai.GenerativeModel("gemini-2.0-flash")

# Load FAISS Vector Store
EMBED_MODEL = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
db = FAISS.load_local("faiss_index", EMBED_MODEL, allow_dangerous_deserialization=True)

# -------- PROMPTS WITH STRUCTURED GUIDANCE -------- #
# Prompt for point-wise summaries
point_wise_prompt = PromptTemplate(
    input_variables=["context", "query"],
    template="""
Please provide a clear, concise point-wise summary or explanation for the following:

Context: {context}

Question: {query}

Points:
1.
2.
3.
...
"""
)

# Prompt for step-by-step explanations
step_by_step_prompt = PromptTemplate(
    input_variables=["context", "query"],
    template="""
Explain the following in a step-by-step manner, numbering each step clearly:

Context: {context}

Question: {query}

Steps:
1.
2.
3.
...
"""
)

# Prompt for extracting key points
key_points_prompt = PromptTemplate(
    input_variables=["context", "query"],
    template="""
Extract the key points from the following context relevant to the question. Present each point as a separate item:

Context: {context}

Question: {query}

Key Points:
- 
- 
- 
...
"""
)

# General assistant prompt with structured response
assistant_prompt = PromptTemplate(
    input_variables=["context", "query"],
    template="""
You are a helpful assistant. Use the context below to answer the question if relevant, and present the information in a structured, point-wise format for clarity.

Context: {context}

Question: {query}

"""
)

# Search-specific prompt
search_prompt = PromptTemplate(
    input_variables=["context", "query"],
    template="""
You are a document search assistant. If the user asks casually, respond naturally. For document-related queries, use the context below to provide a structured, point-wise answer.

Context: {context}

Question: {query}


"""
)

# Agent prompt for complex interactions
agent_prompt = PromptTemplate(
    input_variables=["context", "query"],
    template="""
You are GenAI Agent — a smart enterprise agent. Respond naturally, and organize your answer in a clear, structured manner, using points, steps, or sections as needed.

Context: {context}

User: {query}

Response:
 **Introduction** (if applicable)
 **Main Points or Steps**:
   - Point/Step 1: Description
   - Point/Step 2: Description
   - ...
 **Summary or Final Remarks**
"""
)

# -------- UTILITY TO FORMAT SOURCES -------- #
def format_sources(docs):
    """Returns a formatted string of document sources"""
    if not docs:
        return ""
    seen = set()
    source_list = []
    for doc in docs:
        source = doc.metadata.get("source", "Unknown source")
        if source not in seen:
            seen.add(source)
            source_list.append(f"- {source}")
    return "\n📚 Sources:\n" + "\n".join(source_list)

# -------- UTILITY TO CHECK IF QUERY IS CASUAL OR GENERAL -------- #
def is_casual_or_general_query(query: str) -> bool:
    casual_patterns = [
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
        "how are you", "what's up", "thanks", "thank you", "bye", "goodbye",
        "what can you do", "help me", "who are you", "what are you"
    ]
    query_lower = query.lower().strip()
    return any(pattern in query_lower for pattern in casual_patterns) or len(query_lower.split()) <= 3

# -------- IMPROVED RELEVANCE CHECK -------- #
def is_document_relevant(query: str, docs, min_word_overlap: float = 0.15) -> tuple:
    """
    Checks if docs are relevant based on flexible criteria
    """
    if not docs:
        return False, []

    query_lower = query.lower()
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'what', 'how', 'when', 'where', 'why', 'who'}
    query_words = set(word.strip('.,!?;:') for word in query_lower.split() if len(word) > 2 and word not in stop_words)

    if not query_words:
        return False, []

    relevant_docs = []

    for doc in docs:
        content_lower = doc.page_content.lower()
        content_words = set(content_lower.split())

        overlap = len(query_words.intersection(content_words))
        overlap_ratio = overlap / len(query_words) if query_words else 0

        is_doc_relevant = (
            overlap_ratio >= min_word_overlap or
            overlap >= 2 or
            any(word in content_lower for word in query_words if len(word) > 4)
        )

        if is_doc_relevant:
            relevant_docs.append(doc)

    is_relevant = len(relevant_docs) > 0
    return is_relevant, relevant_docs

# -------- IMPROVED SIMILARITY SEARCH WITH BETTER FILTERING -------- #
def get_relevant_documents(query: str, k: int = 8):
    """Retrieve relevant documents with lenient filtering"""
    try:
        docs_with_scores = db.similarity_search_with_score(query, k=k)

        if not docs_with_scores:
            return []

        best_score = docs_with_scores[0][1]
        filtered_docs = []

        for doc, score in docs_with_scores:
            if score <= best_score + 0.5:  # Increased threshold
                filtered_docs.append(doc)

        is_relevant, relevant_docs = is_document_relevant(query, filtered_docs, min_word_overlap=0.1)

        if not relevant_docs and filtered_docs:
            print(f"⚠️ No docs passed relevance check, using top {min(3, len(filtered_docs))} similarity matches")
            return filtered_docs[:3]

        return relevant_docs

    except Exception as e:
        print(f"Error in similarity search: {e}")
        docs = db.similarity_search(query, k=k)
        is_relevant, relevant_docs = is_document_relevant(query, docs, min_word_overlap=0.1)
        return relevant_docs if relevant_docs else docs[:3]

# -------- POLICY-SPECIFIC SEARCH -------- #
def search_all_policies(query: str, k: int = 10):
    """Search across different policy documents ensuring diversity"""
    try:
        docs_with_scores = db.similarity_search_with_score(query, k=k)
        if not docs_with_scores:
            return []

        # Group by source for diversity
        docs_by_source = {}
        for doc, score in docs_with_scores:
            source = doc.metadata.get("source", "unknown")
            if source not in docs_by_source:
                docs_by_source[source] = []
            docs_by_source[source].append((doc, score))

        # Take top docs from each source
        diverse_docs = []
        for source, source_docs in docs_by_source.items():
            source_docs.sort(key=lambda x: x[1])  # sort by score
            diverse_docs.extend([doc for doc, score in source_docs[:2]])

        is_relevant, relevant_docs = is_document_relevant(query, diverse_docs, min_word_overlap=0.1)
        return relevant_docs if relevant_docs else diverse_docs[:5]

    except Exception as e:
        print(f"Error in policy search: {e}")
        return []

# -------- RESPONSE FUNCTIONS USING STRUCTURED PROMPTS -------- #
def answer_query(query: str) -> str:
    if is_casual_or_general_query(query):
        prompt = assistant_prompt.format(context="No specific context needed for casual interaction.", query=query)
        return gemini.generate_content(prompt).text.strip()

    relevant_docs = get_relevant_documents(query, k=6)
    if relevant_docs:
        context = "\n\n".join([d.page_content for d in relevant_docs])
        prompt = assistant_prompt.format(context=context, query=query)
        answer = gemini.generate_content(prompt).text.strip()
        sources = format_sources(relevant_docs)
        return f"{answer}\n\n{sources}"
    else:
        prompt = assistant_prompt.format(context="No relevant documents found.", query=query)
        return gemini.generate_content(prompt).text.strip()

def answer_query_search_mode(query: str) -> str:
    if is_casual_or_general_query(query):
        prompt = search_prompt.format(context="No specific context needed for casual interaction.", query=query)
        return gemini.generate_content(prompt).text.strip()

    relevant_docs = search_all_policies(query, k=10)
    if relevant_docs:
        context = "\n\n".join([d.page_content for d in relevant_docs])
        prompt = search_prompt.format(context=context, query=query)
        answer = gemini.generate_content(prompt).text.strip()
        sources = format_sources(relevant_docs)
        return f"{answer}\n\n{sources}"
    else:
        return "No relevant information found in the documents. Feel free to ask me something else or try a different search term!"

def answer_query_agent_mode(query: str) -> str:
    if is_casual_or_general_query(query):
        prompt = agent_prompt.format(context="General conversation context.", query=query)
        return gemini.generate_content(prompt).text.strip()

    relevant_docs = search_all_policies(query, k=8)
    if relevant_docs:
        context = "\n\n".join([d.page_content for d in relevant_docs])
    else:
        context = "No specific document context available."

    prompt = agent_prompt.format(context=context, query=query)
    answer = gemini.generate_content(prompt).text.strip()
    return answer

# -------- DEBUG FUNCTION -------- #
def debug_query_relevance(query: str):
    """Debug the document retrieval and relevance filtering"""
    print(f"🔍 Debugging query: '{query}'")
    docs = db.similarity_search_with_score(query, k=10)
    print(f"📄 Basic search found: {len(docs)} documents")
    docs_by_source = {}
    for doc, score in docs:
        source = doc.metadata.get('source', 'Unknown')
        if source not in docs_by_source:
            docs_by_source[source] = []
        docs_by_source[source].append((doc, score))
    print(f"📚 Documents by source:")
    for source, source_docs in docs_by_source.items():
        print(f"  {source}: {len(source_docs)} documents")
        for i, (doc, score) in enumerate(source_docs[:2]):
            print(f"    Doc {i+1}: Score {score:.3f}")
    # Relevance filtering
    docs_only = [doc for doc, score in docs]
    is_relevant, relevant_docs = is_document_relevant(query, docs_only)
    print(f"🎯 Relevant documents after filtering: {len(relevant_docs)}")
    print(f"✅ Is relevant: {is_relevant}")
    if relevant_docs:
        relevant_sources = set(doc.metadata.get('source', 'Unknown') for doc in relevant_docs)
        print(f"📋 Sources in final results: {relevant_sources}")
        
def rag_answer(query: str) -> str:
    docs = db.similarity_search(query, k=3)
    context = "\n".join([doc.page_content for doc in docs])
    answer = gemini.generate_content(f"{context}\n\nQuestion: {query}")
    # Add citations
    sources = [doc.metadata.get("source", "Unknown") for doc in docs]
    citations = "\n".join([f"[{i+1}] {src}" for i, src in enumerate(sources)])
    return f"{answer.text}\n\nSources:\n{citations}"
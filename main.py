from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database Configuration
DATABASE_URL = "postgresql://postgres:Mani8143@localhost:5432/CRM_TOOL"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Employee Table
class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    position = Column(String, nullable=False)

# Initialize the Database
def initialize_database():
    Base.metadata.create_all(bind=engine)

# FastAPI App
app = FastAPI()

# Endpoint to Add an Employee
@app.post("/employees/")
def add_employee(name: str, email: str, position: str):
    session = SessionLocal()
    try:
        new_employee = Employee(name=name, email=email, position=position)
        session.add(new_employee)
        session.commit()
        session.refresh(new_employee)
        return {"message": "Employee added successfully!", "employee_id": new_employee.id}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        session.close()

# Endpoint to Fetch All Employees
@app.get("/employees/")
def fetch_employees():
    session = SessionLocal()
    employees = session.query(Employee).all()
    session.close()
    return employees

# Main Block
if __name__ == "__main__":
    print("Initializing the database...")
    initialize_database()
    print("Database initialized. Use 'uvicorn filename:app --reload' to start the server.")

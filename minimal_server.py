from fastapi import FastAPI

app = FastAPI(title="Zaradam API")

@app.get("/api/")
async def root():
    return {"message": "Zaradam API is running!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
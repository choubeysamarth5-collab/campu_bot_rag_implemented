from flask import Flask, request, jsonify
import pickle
import subprocess
import os

app = Flask(__name__)

MODEL_PATH = "./model.pkl"
VECTORIZER_PATH = "./vectorizer.pkl"
DATASET_PATH = "./dataset.csv"

model = None
vectorizer = None

def load_model():
    global model, vectorizer
    if os.path.exists(MODEL_PATH) and os.path.exists(VECTORIZER_PATH):
        model = pickle.load(open(MODEL_PATH, "rb"))
        vectorizer = pickle.load(open(VECTORIZER_PATH, "rb"))

load_model()

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/predict", methods=["POST"])
def predict():
    if model is None or vectorizer is None:
        return jsonify({"error": "Model not trained yet"}), 503
    text = request.json["text"]
    X = vectorizer.transform([text])
    prediction = model.predict(X)[0]
    return jsonify({"intent": prediction})

@app.route("/train", methods=["POST"])
def train():
    if "dataset" not in request.files:
        return jsonify({"success": False, "message": "No dataset file uploaded."}), 400

    file = request.files["dataset"]
    if file.filename == "":
        return jsonify({"success": False, "message": "Empty filename."}), 400

    file.save(DATASET_PATH)

    try:
        result = subprocess.run(
            ["python", "train.py"],
            capture_output=True, text=True, check=True
        )
    except subprocess.CalledProcessError as e:
        return jsonify({
            "success": False,
            "message": "Training script failed.",
            "error": e.stderr
        }), 500

    load_model()

    return jsonify({
        "success": True,
        "message": "Model trained successfully!",
        "log": result.stdout
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
from flask import Flask, request, jsonify
import pickle

app = Flask(__name__)

model = pickle.load(
    open("./model.pkl", "rb")
)

vectorizer = pickle.load(
    open("./vectorizer.pkl", "rb")
)

@app.route("/predict", methods=["POST"])
def predict():

    text = request.json["text"]

    X = vectorizer.transform([text])

    prediction = model.predict(X)[0]

    return jsonify({
        "intent": prediction
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
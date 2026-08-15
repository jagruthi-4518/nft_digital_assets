from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)
PINATA_JWT = os.getenv("PINATA_JWT")


@app.route("/api/upload", methods=["POST"])          # <-- NEW ROUTE GOES HERE
def upload():
    data = request.get_json()
    assetName = data.get("assetName")
    assetType = data.get("assetType")
    content = data.get("content")
    contentHash = data.get("contentHash")
    if not assetName or not assetType or not content or not contentHash:
        return jsonify({"error": "Missing fields"}), 400
    try:
        res = requests.post(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {PINATA_JWT}"
            },
            json={
                "pinataContent": {
                    "name": assetName,
                    "description": "Tokenized asset",
                    "assetType": assetType,
                    "content": content,
                    "contentHash": contentHash
                }
            }
        )
        if res.status_code != 200:
            return jsonify({"error": "Pinata upload failed"}), 500
        data = res.json()
        return jsonify({
            "tokenURI": f"ipfs://{data['IpfsHash']}",
            "cid": data["IpfsHash"]
        })
    except Exception as e:
        print(e)
        return jsonify({"error": "Upload failed"}), 500


@app.route("/api/upload-file", methods=["POST"])      # <-- your existing route, unchanged
def upload_file():
    assetName = request.form.get("assetName")
    assetType = request.form.get("assetType")
    contentHash = request.form.get("contentHash")
    file = request.files.get("file")

    if not assetName or not assetType or not contentHash or not file:
        return jsonify({"error": "Missing fields"}), 400

    try:
        file_res = requests.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            headers={"Authorization": f"Bearer {PINATA_JWT}"},
            files={"file": (file.filename, file.stream, file.mimetype)}
        )
        if file_res.status_code != 200:
            return jsonify({"error": "Pinata file upload failed"}), 500

        file_cid = file_res.json()["IpfsHash"]
        file_uri = f"ipfs://{file_cid}"

        meta_res = requests.post(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {PINATA_JWT}"
            },
            json={
                "pinataContent": {
                    "name": assetName,
                    "description": "Tokenized asset",
                    "assetType": assetType,
                    "contentHash": contentHash,
                    "fileName": file.filename,
                    "mimeType": file.mimetype,
                    "assetfile": file_uri
                }
            }
        )
        if meta_res.status_code != 200:
            return jsonify({"error": "Pinata metadata upload failed"}), 500

        meta_cid = meta_res.json()["IpfsHash"]

        return jsonify({
            "tokenURI": f"ipfs://{meta_cid}",
            "cid": meta_cid
        })

    except Exception as e:
        print(e)
        return jsonify({"error": "Upload failed"}), 500


if __name__ == "__main__":
    app.run(port=3001, debug=True)
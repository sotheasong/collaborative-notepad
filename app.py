import os
import re
from pathlib import Path
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv


load_dotenv()

app = Flask(__name__)

@app.route('/')
def index():
    return

if __name__ == '__main__':
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(host=host, port=port, debug=False)
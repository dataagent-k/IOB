import os
import pandas as pd
import webbrowser
import pyperclip
import requests
import smtplib
from email.message import EmailMessage
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import io
# REMOVED: from papaparse import parse

# Load environment variables from .env file
load_dotenv()

# --- App Initialization ---
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:8080"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"]
    }
})

# --- API Keys & Credentials ---
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")
MY_EMAIL = os.getenv("MY_EMAIL")
MY_EMAIL_APP_PASSWORD = os.getenv("MY_EMAIL_APP_PASSWORD")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# --- Database Path ---
CSV_FILE = 'investors.csv'

# --- Your Company's Data (for Likelihood Score) ---
YOUR_COMPANY_DATA = {
    "sector": "AI, SaaS",
    "stage": "Pre-Seed"
}

# --- Likelihood Score Calculation (Advanced) ---
def calculate_likelihood(investor_row, company_data):
    score = 0
    investor_sectors = [s.strip().lower() for s in str(investor_row.get('sector_focus', '')).split(';')]
    your_sectors = [s.strip().lower() for s in company_data['sector'].split(',')]
    
    match_count = len(set(investor_sectors) & set(your_sectors))
    if match_count > 0:
        score += 25
        if match_count == len(your_sectors):
            score += 15

    if company_data['stage'].lower() == str(investor_row.get('stage_focus', '')).lower():
        score += 30

    if pd.notna(investor_row.get('twitter_handle')):
        score += 5
    if pd.notna(investor_row.get('bio')):
        score += 5

    return min(score, 100)

# --- API Endpoints ---

@app.route('/api/investors', methods=['GET'])
def get_investors():
    try:
        if not os.path.exists(CSV_FILE):
             return jsonify([])
        df = pd.read_csv(CSV_FILE)
        df = df.where(pd.notna(df), None)
        investors = df.to_dict('records')
        for investor in investors:
            investor['likelihood_score'] = calculate_likelihood(investor, YOUR_COMPANY_DATA)
        return jsonify(investors)
    except Exception as e:
        return jsonify({"error": f"An error occurred: {e}"}), 500

@app.route('/api/add_investor', methods=['POST'])
def add_investor():
    data = request.json
    try:
        df = pd.read_csv(CSV_FILE) if os.path.exists(CSV_FILE) else pd.DataFrame(columns=data.keys())
        new_id = df['id'].max() + 1 if not df.empty else 1
        data['id'] = new_id
        
        new_investor_df = pd.DataFrame([data])
        df = pd.concat([df, new_investor_df], ignore_index=True)
        
        df.to_csv(CSV_FILE, index=False)
        return jsonify({"message": "Investor added successfully", "investor": data}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- UPDATED: This endpoint now uses pandas directly ---
@app.route('/api/upload_csv', methods=['POST'])
def upload_csv():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    try:
        # Read the uploaded file stream directly into a pandas DataFrame
        upload_df = pd.read_csv(file.stream)

        if os.path.exists(CSV_FILE):
            existing_df = pd.read_csv(CSV_FILE)
            for col in upload_df.columns:
                if col not in existing_df.columns:
                    existing_df[col] = None
            
            last_id = existing_df['id'].max() if not existing_df.empty else 0
            upload_df['id'] = range(last_id + 1, last_id + 1 + len(upload_df))

            combined_df = pd.concat([existing_df, upload_df], ignore_index=True)
        else:
            upload_df['id'] = range(1, len(upload_df) + 1)
            combined_df = upload_df

        combined_df.to_csv(CSV_FILE, index=False)
        return jsonify({"message": f"{len(upload_df)} investors added successfully."})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/download_template', methods=['GET'])
def download_template():
    template_path = 'template.csv'
    if not os.path.exists(template_path):
        headers = "id,name,twitter_handle,fund,stage_focus,linkedin_url,avatar_url,bio,thesis,check_size,sector_focus,portfolio_companies,status,notes_for_pitch,domain\n"
        with open(template_path, 'w') as f:
            f.write(headers)
    return send_from_directory(directory='.', path=template_path, as_attachment=True)

@app.route('/api/generate_tips', methods=['POST'])
def generate_tips():
    data = request.json
    investor_bio = data.get('bio', '')
    investor_thesis = data.get('thesis', '')
    investor_name = data.get('name', '')

    prompt = f"""
    You are an expert fundraising assistant. Your goal is to give a startup founder 3 specific, actionable, and personalized talking points for a video pitch to an investor.

    Investor Details:
    - Name: {investor_name}
    - Bio: {investor_bio}
    - Investment Thesis: {investor_thesis}

    Your Task:
    Based on the investor's details, generate 3 unique talking points. Each point should be a single sentence. The tone should be confident and direct. Do not use generic advice. Focus on creating a personal connection.

    Example Output Format:
    1. Point one...
    2. Point two...
    3. Point three...
    """

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={ "Authorization": f"Bearer {OPENROUTER_API_KEY}" },
            json={
                "model": "mistralai/mistral-7b-instruct:free",
                "messages": [ {"role": "user", "content": prompt} ]
            }
        )
        response.raise_for_status()
        api_data = response.json()
        tips = api_data['choices'][0]['message']['content']
        return jsonify({"tips": tips})
    except Exception as e:
        return jsonify({"error": f"Failed to generate tips: {str(e)}"}), 500

@app.route('/api/find_email', methods=['POST'])
def find_email():
    data = request.json
    first_name = data.get('name', '').split(' ')[0]
    last_name = data.get('name', '').split(' ')[-1]
    domain = data.get('domain')
    
    if not all([first_name, last_name, domain]):
        return jsonify({"error": "Name and domain are required"}), 400

    url = f"https://api.hunter.io/v2/email-finder?domain={domain}&first_name={first_name}&last_name={last_name}&api_key={HUNTER_API_KEY}"

    try:
        response = requests.get(url)
        response.raise_for_status()
        email_data = response.json()
        email = email_data.get('data', {}).get('email', 'Not found')
        return jsonify({"email": email})
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API request failed: {e}"}), 500

@app.route('/api/send_email', methods=['POST'])
def send_email_pitch():
    data = request.json
    to_email = data.get('to_email')
    subject = data.get('subject')
    body = data.get('body')

    if not all([to_email, subject, body]):
        return jsonify({"error": "to_email, subject, and body are required"}), 400

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = MY_EMAIL
    msg['To'] = to_email
    msg.set_content(body, subtype='html')

    try:
        with smtplib.SMTP_SSL('smtpout.secureserver.net', 465) as smtp_server:
            smtp_server.login(MY_EMAIL, MY_EMAIL_APP_PASSWORD)
            smtp_server.send_message(msg)
        return jsonify({"message": "Email sent successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/prep_linkedin', methods=['POST'])
def prep_linkedin():
    data = request.json
    investor_id = int(data.get('id'))
    df = pd.read_csv(CSV_FILE)
    investor = df[df['id'] == investor_id].iloc[0]
    
    message = f"Hi {investor['name'].split()[0]},\n\nI saw your work with {investor['portfolio_companies'].split(';')[0].strip()} and was really impressed. My startup, OpenCrew AI, is also in the {investor['sector_focus'].split(';')[0].strip()} space.\n\nWould be great to connect."
    
    try:
        pyperclip.copy(message)
        webbrowser.open(investor['linkedin_url'])
        return jsonify({"message": "LinkedIn message copied and profile opened!"})
    except Exception as e:
        return jsonify({"error": f"Failed to perform LinkedIn prep: {str(e)}"}), 500

@app.route('/api/update_status', methods=['POST'])
def update_status():
    data = request.json
    investor_id = int(data.get('id'))
    new_status = data.get('status')

    try:
        df = pd.read_csv(CSV_FILE)
        df.loc[df['id'] == investor_id, 'status'] = new_status
        df.to_csv(CSV_FILE, index=False)
        return jsonify({"message": f"Status updated for investor {investor_id}"})
    except Exception as e:
        return jsonify({"error": f"Could not update CSV: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
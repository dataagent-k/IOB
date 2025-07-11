import os
import pandas as pd
import webbrowser
# import pyperclip
import requests
import smtplib
from email.message import EmailMessage
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- App Initialization ---
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:8080"],  # Vite's default port
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type"]
    }
})
# --- API Keys & Credentials ---
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")
MY_EMAIL = os.getenv("MY_EMAIL")
MY_EMAIL_APP_PASSWORD = os.getenv("MY_EMAIL_APP_PASSWORD")

# --- Database Path ---
CSV_FILE = 'investors.csv'

# --- Your Company's Data (for Likelihood Score) ---
YOUR_COMPANY_DATA = {
    "sector": "AI, SaaS",
    "stage": "Pre-Seed"
}

def calculate_likelihood(investor_row, company_data):
    """Calculates a likelihood score based on defined rules."""
    score = 0
    if any(s.strip() in investor_row.get('sector_focus', '') for s in company_data['sector'].split(',')):
        score += 30
    if company_data['stage'] == investor_row.get('stage_focus', ''):
        score += 20
    if pd.notna(investor_row.get('twitter_handle')):
        score += 5
    return score

# --- API Endpoints ---

@app.route('/api/investors', methods=['GET'])
def get_investors():
    try:
        df = pd.read_csv(CSV_FILE)
        df = df.where(pd.notna(df), None)
        investors = df.to_dict('records')
        for investor in investors:
            investor['likelihood_score'] = calculate_likelihood(investor, YOUR_COMPANY_DATA)
        return jsonify(investors)
    except FileNotFoundError:
        return jsonify({"error": "investors.csv not found"}), 404

# @app.route('/api/find_email', methods=['POST'])
# def find_email():
#     """
#     MODIFIED: Uses a direct HTTP request to the Hunter API.
#     """
#     data = request.json
#     first_name = data.get('name', '').split(' ')[0]
#     last_name = data.get('name', '').split(' ')[-1]
#     # We need a domain, which we can derive from the fund name
#     # This is a simplification; you might need a better way to get the exact domain
#     company_name = data.get('company', '').replace(' ', '').replace('Ventures','').replace('Capital','').lower()
#     domain = f"{company_name}.com"
    
#     if not first_name or not last_name or not domain:
#         return jsonify({"error": "Name and company are required"}), 400

#     url = f"https://api.hunter.io/v2/email-finder?domain={domain}&first_name={first_name}&last_name={last_name}&api_key={HUNTER_API_KEY}"

#     try:
#         response = requests.get(url)
#         response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
#         email_data = response.json()
#         email = email_data.get('data', {}).get('email', 'Not found')
#         return jsonify({"email": email})
#     except requests.exceptions.RequestException as e:
#         return jsonify({"error": str(e)}), 500


@app.route('/api/find_email', methods=['POST'])
def find_email():
    """
    MODIFIED: Uses a direct HTTP request and the domain from the CSV.
    """
    data = request.json
    first_name = data.get('name', '').split(' ')[0]
    last_name = data.get('name', '').split(' ')[-1]
    # UPDATED: We now get the reliable domain directly from the front-end
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
        # This will now give you a more specific error if the key is wrong or the domain is bad
        return jsonify({"error": f"API request failed: {e}"}), 500


@app.route('/api/send_email', methods=['POST'])
def send_email_pitch():
    """
    MODIFIED: Sends email using GoDaddy's SMTP server.
    """
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
    msg.set_content(body, subtype='html') # Assuming your body is HTML

    try:
        # Connect to GoDaddy's SMTP server using the provided settings
        with smtplib.SMTP_SSL('smtpout.secureserver.net', 465) as smtp_server:
            # For GoDaddy, you typically use your full email address and your regular email password
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
    message = f"Hi {investor['name'].split()[0]},\n\nI saw your work with {investor['portfolio_companies'].split(',')[0].strip()} and was really impressed. My startup is also in the {investor['sector_focus'].split(',')[0].strip()} space.\n\nWould be great to connect."
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
    df = pd.read_csv(CSV_FILE)
    df.loc[df['id'] == investor_id, 'status'] = new_status
    df.to_csv(CSV_FILE, index=False)
    return jsonify({"message": f"Status updated for investor {investor_id}"})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
import os
import json
import logging
import sys
from flask import Flask, request, jsonify
import argparse

# Add the current directory to the path so we can import modules correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from API_services.apify import APIFY_LinkedIn_WebScrape
from API_services.linkedin_scraper_service import scrape_linkedin_profile

# from groq import Groq
from dotenv import load_dotenv
from flask_cors import CORS
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables from the .env file in the current directory
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# client = Groq(api_key=os.getenv("GROQ_API_KEY"))
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))


@app.route("/scrape-linkedin", methods=["POST"])
def scrape_linkedin():
    data = request.get_json()

    if not data or "url" not in data:
        return jsonify({"error": "Missing URL in request"}), 400

    url = data["url"]
    prompt = data["prompt"]

    try:
        result_str = APIFY_LinkedIn_WebScrape(url)
        result = json.loads(result_str)

        email = result.get("email")
        about = result.get("about", "")
        headline = result.get("headline", "")
        fullName = result.get("fullName", "")

        message = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(
                system_instruction='You\'re a skilled  copywriter who knows how to write cold emails that actually get replies. Your job is to craft short, thoughtful, and personalized emails for enterprise decision-makers based on their LinkedIn profiles and a quick briefing on the product or service being offered.\n\nHere\'s what you\'ll get to work with:\n\n- A snapshot of the person\'s LinkedIn info — things like their name, job title, company, industry, recent posts, achievements, or shared interests.  \n- A campaign prompt that explains the product/service, the value it brings, and what kind of call-to-action we\'re aiming for.\n\n**Your task:**\nWrite only the body of the email (no subject line or extra headers) using the following rules:\n\n- Always start with: **Dear [First Name],**\n- Keep it brief — aim for **4 to 6 sentences total**\n- Make it personal — use **relevant LinkedIn details** to show we\'ve done our homework\n- Focus on **real value** — how does this offering help solve a challenge or make their work easier, faster, or more effective?\n- Use a **natural, conversational tone** — like it was written by a thoughtful human\n- End with a **light, low-pressure CTA** — like asking if they\'d be open to a quick call or if it makes sense to connect\n- Avoid all fluff — skip generic intros like "Hope you\'re well," marketing buzzwords, or long walls of text\n\n**Output format (JSON only):**\n```json\n{\n  "email_output": "The full body of the email starting with \'Dear [First Name],\'",\n  "analysis_rationale": [\n    "Insightful reasoning based on LinkedIn activity or achievements — e.g., recent promotion, project success, or strong content engagement",\n    "What makes this person\'s performance or profile impressive and why it was used in the email",\n    "Any connections between their career performance and the value proposition of the offering"\n  ]\n}\n```\n\n**Never include anything outside this JSON structure. No explanations, no extra text, just valid JSON.**'
            ),
            contents=[
                f"Their name is {fullName}.\n\n***Important prompt***:[ {prompt} ]. {headline}. {about}."
            ],
        )

        response = message.text

        # Extract JSON from the response
        if "```json" in response and "```" in response:
            json_str = response.split("```json")[1].split("```")[0].strip()
        else:
            json_str = response

        json_response = json.loads(json_str)

        return jsonify(
            {
                "email": email,
                "groq_response": json_response["email_output"],
                "analysis_rationale": json_response["analysis_rationale"],
            }
        )

    except Exception as e:
        logger.error(f"Error in scrape-linkedin: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/improve-email", methods=["POST"])
def improve_email():
    data = request.get_json()

    if not data or "email" not in data or "prompt" not in data:
        return jsonify({"error": "Missing email or prompt in request"}), 400

    email_content = data["email"]
    prompt = data["prompt"]
    recipient_name = data.get("recipient_name", "the recipient")

    try:
        message = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(
                system_instruction='You\'re a skilled B2B copywriter who knows how to improve cold emails to make them more effective. Your job is to refine and enhance an existing email based on specific improvement instructions.\n\n**Your task:**\nImprove the provided email using the following rules:\n\n- Always start with: **Dear [First Name],**\n- Keep it brief — aim for **4 to 6 sentences total**\n- Make it personal and maintain any personalization from the original email\n- Focus on **real value** — how does this offering help solve a challenge or make their work easier, faster, or more effective?\n- Use a **natural, conversational tone** — like it was written by a thoughtful human\n- End with a **light, low-pressure CTA** — like asking if they\'d be open to a quick call or if it makes sense to connect\n- Avoid all fluff — skip generic intros like "Hope you\'re well," marketing buzzwords, or long walls of text\n\n**Output format (JSON only):**\n```json\n{\n  "email_output": "The full body of the improved email starting with \'Dear [First Name],\'",\n  "improvement_rationale": [\n    "Explanation of key improvements made to the email",\n    "How the improvements address the specific prompt instructions",\n    "Why these changes will make the email more effective"\n  ]\n}\n```\n\n**Never include anything outside this JSON structure. No explanations, no extra text, just valid JSON.**'
            ),
            contents=[
                f"Here is the original email:\n\n{email_content}\n\nThe recipient's name is {recipient_name}.\n\nImprovement instructions: {prompt}"
            ],
        )

        response = message.text

        # Extract JSON from the response
        if "```json" in response and "```" in response:
            json_str = response.split("```json")[1].split("```")[0].strip()
        else:
            json_str = response

        json_response = json.loads(json_str)

        return jsonify(
            {
                "improved_email": json_response["email_output"],
                "improvement_rationale": json_response["improvement_rationale"],
            }
        )

    except Exception as e:
        logger.error(f"Error in improve-email: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/scrape-linkedin-profile", methods=["POST"])
def scrape_linkedin_profile_endpoint():
    data = request.get_json()

    if not data or "url" not in data:
        logger.error("Missing URL in LinkedIn profile scrape request")
        return jsonify({"error": "Missing URL in request"}), 400

    url = data["url"]
    logger.info(f"Received request to scrape LinkedIn profile: {url}")

    try:
        profile_data = scrape_linkedin_profile(url)

        if isinstance(profile_data, dict) and "error" in profile_data:
            error_message = profile_data["error"]
            logger.error(f"Error from scraper: {error_message}")
            return jsonify({"error": error_message}), 500

        logger.info(
            f"Successfully scraped profile for: {profile_data.get('name', 'Unknown')}"
        )
        return jsonify(profile_data)

    except Exception as e:
        logger.error(f"Unexpected error in scrape-linkedin-profile: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Endpoint to verify the API is running"""
    return jsonify({"status": "ok", "message": "Service is running"}), 200


if __name__ == "__main__":
    # Create argument parser for command line options
    parser = argparse.ArgumentParser(description="Start the API server")
    parser.add_argument(
        "--port",
        type=int,
        default=5000,
        help="Port to run the server on (default: 5000)",
    )
    args = parser.parse_args()

    port = int(os.environ.get("PORT", args.port))
    print(f"Starting server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)

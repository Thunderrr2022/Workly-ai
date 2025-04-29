from apify_client import ApifyClient
from dotenv import load_dotenv
import os
import json

load_dotenv("../.env")


def APIFY_LinkedIn_WebScrape(url: str) -> str:
    API_TOKEN = os.getenv("APIFY_API_TOKEN")
    print(
        f"APIFY_API_TOKEN: {API_TOKEN[:5]}...{API_TOKEN[-5:] if API_TOKEN else 'None'}"
    )
    client = ApifyClient(API_TOKEN)

    if API_TOKEN is None:
        print("ERROR: No APIFY API token found!")
        return json.dumps({"error": "No API token found"})

    print(f"Preparing APIFY Actor input for URL: {url}")
    # Prepare the Actor input .
    run_input = {"profileUrls": [url]}

    # Max: The "2SyF0bVxmgGr8IVCZ" is just the ID for Apify ,DONT be stupid and touch it, I got it from the Docs
    try:
        print("Calling APIFY Actor...")
        run = client.actor("2SyF0bVxmgGr8IVCZ").call(run_input=run_input)
        print(
            f"APIFY run completed with defaultDatasetId: {run.get('defaultDatasetId', 'none')}"
        )
    except Exception as e:
        print(f"APIFY Actor call failed: {str(e)}")
        return json.dumps({"error": f"APIFY Actor call failed: {str(e)}"})

    """ Max:
    If you are asking why tf this works w "next", imagine vibe coding for a project to semi-work, then going back to fix it
    But then a pro python developer comes and says "Why are't you using next?", and walks up to me to fix this issue
    The worst part is that everything inside of that "next" is actuallu from the Docs
    from the API, so if you genuinely want to hurt yourself worse than my first time creating an account for Microsoft Azure, be my guest, but be warned 

    This witchcraft was the old code:
    
    for item in client.dataset(run["defaultDatasetId"]).iterate_items():
        break

    Truly a Claude 3.7 moment.
    
    TLDR: Dont touch this line, it works
    """
    try:
        print("Getting data from APIFY dataset...")
        item = next(client.dataset(run["defaultDatasetId"]).iterate_items())
        print(f"Successfully retrieved data item: {str(item)[:200]}...")
    except Exception as e:
        print(f"Error retrieving data from APIFY: {str(e)}")
        return json.dumps({"error": f"Error retrieving data from APIFY: {str(e)}"})
    """
    TOUCHING CODE BELOW THIS POINT IS OK
    -----
    """
    # Ensure keys exist before accessing them
    about = item.get("about", "")
    headline = item.get("headline", "")
    email = item.get("email", "")
    fullName = item.get("fullName", "")

    result = {
        "about": about,
        "headline": headline,
        "email": email,
        "fullName": fullName,
    }

    return json.dumps(result, indent=2)

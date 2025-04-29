from linkedin_scraper import Person, actions
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.common.exceptions import (
    TimeoutException,
    WebDriverException,
    NoSuchElementException,
    ElementNotInteractableException,
    StaleElementReferenceException,
)
from webdriver_manager.chrome import ChromeDriverManager
import json
import os
import logging
from dotenv import load_dotenv
import tempfile
import time
import random
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables from the correct path
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(os.path.dirname(current_dir), ".env")
load_dotenv(env_path)


def retry_with_backoff(func, retries=5, backoff_in_seconds=1):
    """
    Retry a function with exponential backoff
    """
    x = 0
    while True:
        try:
            return func()
        except (
            TimeoutException,
            WebDriverException,
            NoSuchElementException,
            ElementNotInteractableException,
            StaleElementReferenceException,
        ) as e:
            if x == retries:
                raise e
            sleep = backoff_in_seconds * 2**x + random.uniform(0, 1)
            logger.info(f"Retrying after {sleep:.2f} seconds due to error: {str(e)}")
            time.sleep(sleep)
            x += 1


def scrape_linkedin_profile(url: str) -> dict:
    """
    Scrapes a LinkedIn profile using the linkedin_scraper library

    Args:
        url (str): The LinkedIn profile URL to scrape

    Returns:
        dict: Dictionary with scraped profile information
    """
    logger.info(f"Starting to scrape LinkedIn profile: {url}")

    # Set up Chrome options for headless browsing
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument(
        "--disable-blink-features=AutomationControlled"
    )  # Helps avoid detection

    # Rotate user agents to avoid detection
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    ]
    chrome_options.add_argument(f"--user-agent={random.choice(user_agents)}")

    # Create a temporary directory for Chrome user data
    user_data_dir = tempfile.mkdtemp()
    chrome_options.add_argument(f"--user-data-dir={user_data_dir}")

    # Get LinkedIn credentials from environment variables
    email = os.getenv("LINKEDIN_EMAIL")
    password = os.getenv("LINKEDIN_PASSWORD")

    if not email or not password:
        logger.error("LinkedIn credentials not found in environment variables")
        return {"error": "LinkedIn credentials not found in environment variables"}

    driver = None
    try:
        # Initialize the Chrome driver with webdriver-manager
        logger.info("Initializing Chrome driver")
        service = ChromeService(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

        # Set page load timeout
        driver.set_page_load_timeout(45)

        # Login to LinkedIn
        try:
            logger.info("Logging in to LinkedIn")

            def login_action():
                actions.login(driver, email, password)

            # Use retry mechanism for login
            retry_with_backoff(login_action)

            # Wait for login to complete and cookies to be set
            time.sleep(random.uniform(5, 8))

            # Check if login was successful by looking for specific elements
            if "Sign In" in driver.title or "Login" in driver.title:
                logger.error("Login failed - still on login page")
                return {"error": "Failed to login to LinkedIn: Still on login page"}

        except Exception as login_error:
            logger.error(f"Login error: {str(login_error)}")
            return {"error": f"Failed to login to LinkedIn: {str(login_error)}"}

        # Navigate to the profile URL with retry
        try:
            logger.info(f"Navigating to profile URL: {url}")

            def navigate_action():
                driver.get(url)

            # Use retry mechanism for navigation
            retry_with_backoff(navigate_action)

            # Wait for the page to load (dynamic wait)
            time.sleep(random.uniform(3, 5))  # Random sleep to avoid detection
        except Exception as nav_error:
            logger.error(f"Navigation error: {str(nav_error)}")
            return {"error": f"Failed to navigate to profile URL: {str(nav_error)}"}

        # Handle common HTTP errors
        if "Page not found" in driver.title or "404" in driver.title:
            logger.error("404 Not Found - LinkedIn profile doesn't exist")
            return {"error": "LinkedIn profile not found (404)"}

        if "Access Denied" in driver.title or "403" in driver.title:
            logger.error("403 Forbidden - Access denied by LinkedIn")
            return {"error": "Access to this LinkedIn profile is forbidden (403)"}

        # Create Person object and scrape profile
        try:
            logger.info("Scraping profile data")
            person = Person(url, driver=driver, scrape=False)
            person.scrape(close_on_complete=False)

            # Check if meaningful data was extracted
            if not hasattr(person, "name") or not person.name:
                logger.warning(
                    "No name found in the scraped profile - possible scraping failure"
                )

                # Try a fallback method to extract at least basic information
                try:
                    fallback_data = {
                        "name": driver.find_element_by_css_selector(
                            ".text-heading-xlarge"
                        ).text,
                        "about": "",
                        "experiences": [],
                        "educations": [],
                        "skills": [],
                        "accomplishments": [],
                    }
                    logger.info("Using fallback data extraction method")
                    return fallback_data
                except Exception as fallback_error:
                    logger.error(f"Fallback extraction failed: {str(fallback_error)}")
            else:
                logger.info(f"Successfully scraped profile for: {person.name}")

        except Exception as scrape_error:
            logger.error(f"Scraping error: {str(scrape_error)}")
            logger.error(traceback.format_exc())
            return {"error": f"Failed to scrape profile: {str(scrape_error)}"}

        # Extract profile information with defensive coding
        profile_data = {
            "name": person.name if hasattr(person, "name") else "Unknown",
            "about": person.about if hasattr(person, "about") else "",
            "experiences": [
                {
                    "title": getattr(exp, "position_title", ""),
                    "company": getattr(exp, "institution_name", ""),
                    "date_range": getattr(exp, "date_range", ""),
                    "description": getattr(exp, "description", ""),
                }
                for exp in (
                    person.experiences if hasattr(person, "experiences") else []
                )
            ],
            "educations": [
                {
                    "institution": getattr(edu, "institution_name", ""),
                    "degree": getattr(edu, "degree", ""),
                    "date_range": getattr(edu, "date_range", ""),
                }
                for edu in (person.educations if hasattr(person, "educations") else [])
            ],
            "skills": [
                interest
                for interest in (
                    person.interests if hasattr(person, "interests") else []
                )
            ],
            "accomplishments": (
                person.accomplishments if hasattr(person, "accomplishments") else []
            ),
        }

        # Close the driver
        logger.info("Closing Chrome driver")
        driver.quit()

        return profile_data

    except Exception as e:
        # Log the full stack trace for debugging
        logger.error(f"Error scraping LinkedIn profile: {str(e)}")
        logger.error(traceback.format_exc())

        # Make sure to close the driver in case of exception
        if driver:
            try:
                driver.quit()
            except:
                pass
        return {"error": f"Error scraping LinkedIn profile: {str(e)}"}

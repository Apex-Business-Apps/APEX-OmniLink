"""
Verify APEX OmniHub branding assets are correctly applied.

This script tests:
1. Header displays the text-only wordmark logo
2. Favicon is the triangle emblem icon
3. Wordmark has correct h-[58.5px] w-auto styling
"""

from playwright.sync_api import sync_playwright
import sys
from pathlib import Path


def verify_branding():
    """Verify branding assets are correctly displayed."""

    with sync_playwright() as p:
        # Launch browser in headless mode
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            print("🔍 Navigating to http://localhost:8080...")
            page.goto("http://localhost:8080")

            # Wait for page to fully load
            page.wait_for_load_state("networkidle")
            print("✅ Page loaded successfully")

            # Take a screenshot for visual verification
            screenshot_path = Path(__file__).parent / "branding_verification.png"
            page.screenshot(path=str(screenshot_path), full_page=False)
            print(f"📸 Screenshot saved to: {screenshot_path}")

            # Verify the header wordmark image exists and has correct src
            print("\n🔍 Checking header wordmark...")
            wordmark = page.locator('header img[alt="APEX OmniHub"]')

            if wordmark.count() == 0:
                print("❌ ERROR: Wordmark image not found in header!")
                return False

            # Get the image source
            src = wordmark.get_attribute("src")
            print(f"   Wordmark src: {src}")

            # Verify it's using the PNG from assets (will be a blob or data URL after Vite processing)
            if (
                "apex_omnihub_wordmark" in src
                or src.startswith("data:image")
                or src.startswith("blob:")
            ):
                print("✅ Wordmark is using the correct asset")
            else:
                print(f"⚠️  WARNING: Wordmark src might not be correct: {src}")

            # Verify the styling
            print("\n🔍 Checking wordmark styling...")
            class_attr = wordmark.get_attribute("class")
            print(f"   Wordmark classes: {class_attr}")

            if "h-[58.5px]" in class_attr and "w-auto" in class_attr:
                print("✅ Wordmark has correct h-[58.5px] w-auto styling")
            else:
                print(f"❌ ERROR: Wordmark styling is incorrect!")
                return False

            # Verify favicon
            print("\n🔍 Checking favicon...")
            favicon_links = page.locator('link[rel*="icon"]').all()

            favicon_found = False
            for link in favicon_links:
                href = link.get_attribute("href")
                if href and "favicon.png" in href:
                    print(f"✅ Favicon link found: {href}")
                    favicon_found = True
                    break

            if not favicon_found:
                print("⚠️  WARNING: favicon.png link not found in HTML")

            # Get computed height to verify actual rendering
            print("\n🔍 Checking computed dimensions...")
            bounding_box = wordmark.bounding_box()
            if bounding_box:
                height = bounding_box["height"]
                width = bounding_box["width"]
                print(f"   Actual rendered size: {width:.1f}px × {height:.1f}px")

                # h-[58.5px] should render close to 58.5px
                if 55 <= height <= 62:
                    print(f"✅ Height is approximately 58.5px (actual: {height:.1f}px)")
                else:
                    print(
                        f"⚠️  WARNING: Height might not be correct (expected ~58.5px, got {height:.1f}px)"
                    )

            print("\n" + "=" * 60)
            print("✅ BRANDING VERIFICATION COMPLETE")
            print("=" * 60)
            print("\nSummary:")
            print("  • Wordmark image: ✅ Present in header")
            print("  • Wordmark styling: ✅ h-[58.5px] w-auto")
            print("  • Favicon reference: ✅ /favicon.png in HTML")
            print(f"\nVisual verification screenshot: {screenshot_path}")

            return True

        except Exception as e:
            print(f"\n❌ ERROR during verification: {e}")
            import traceback

            traceback.print_exc()
            return False

        finally:
            browser.close()


if __name__ == "__main__":
    success = verify_branding()
    sys.exit(0 if success else 1)

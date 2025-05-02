"""Module for launching browser and accessing Vizcom.ai."""

from __future__ import annotations

import time
import os
import sys
import argparse
import json
import logging
from dotenv import load_dotenv
import base64
import httpx
import mimetypes
from typing import Tuple, Optional

from apify import Actor
from playwright.async_api import async_playwright, Page, ElementHandle

# コマンドライン引数をパースする関数
def parse_args():
    parser = argparse.ArgumentParser(description='Vizcom AI 3D model generator')
    parser.add_argument('--imageUrl', help='URL of the image to process')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    return parser.parse_args()

# セットアップロギング
def setup_logging(debug=False):
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[logging.StreamHandler()]
    )
    return logging.getLogger('vizcom-agent')

# Load environment variables from .env file
load_dotenv()

# --- Utility: prepare image for upload ---
async def _prepare_image_for_upload(actor_input: dict = None) -> Tuple[str, str]:
    """
    Prepare image for upload based on Actor input or fallback to sample image.
    
    Args:
        actor_input: Actor input dictionary, may contain 'imageUrl'
        
    Returns:
        Tuple of (file_path, original_filename)
    """
    actor_input = actor_input or {}
    image_url = actor_input.get('imageUrl')
    
    if image_url:
        try:
            Actor.log.info(f"Downloading image from URL: {image_url}")
            
            # Download the image
            async with httpx.AsyncClient() as client:
                Actor.log.info(f"Sending HTTP request to: {image_url}")
                response = await client.get(image_url, follow_redirects=True, timeout=30.0)
                response.raise_for_status()
                
                Actor.log.info(f"Response status: {response.status_code}, Content type: {response.headers.get('content-type')}, Content length: {len(response.content)} bytes")
            
            # Determine filename and extension
            content_type = response.headers.get('content-type')
            Actor.log.info(f"Content-Type: {content_type}")
            extension = mimetypes.guess_extension(content_type) if content_type else '.png'
            if not extension:
                extension = '.png'
                
            original_filename = os.path.basename(image_url.split('?')[0]) or f"input{extension}"
            if not os.path.splitext(original_filename)[1]:
                original_filename += extension
            
            Actor.log.info(f"Determined original filename: {original_filename} with extension: {extension}")
            
            # Save to disk
            save_path = os.path.join(os.getcwd(), f"downloaded_image{extension}")
            with open(save_path, 'wb') as f:
                f.write(response.content)
                
            Actor.log.info(f"Downloaded image saved to: {save_path} (size: {os.path.getsize(save_path)} bytes)")
            
            # 画像が実際に存在することを確認
            if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
                Actor.log.info(f"Download successful: {save_path}")
                return save_path, original_filename
            else:
                Actor.log.warning(f"Downloaded file is missing or empty. Falling back to sample image.")
                raise Exception("Downloaded file is missing or empty")
            
        except Exception as e:
            Actor.log.warning(f"Failed to download image: {e}. Falling back to sample image.")
    else:
        Actor.log.info("No image URL provided. Using sample image.")
    
    # Create sample image
    sample_path = os.path.join(os.getcwd(), 'sample.png')
    Actor.log.info(f"Using sample image at: {sample_path}")
    
    if not os.path.isfile(sample_path):
        # 1x1 white PNG
        Actor.log.info("Creating a new sample image (1x1 white pixel)")
        pixel_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABAABJzQnCgAAAABJRU5ErkJggg=='
        with open(sample_path, 'wb') as f:
            f.write(base64.b64decode(pixel_b64))
        Actor.log.info(f"Created sample image at: {sample_path}")
    
    return sample_path, "sample.png"

# --- Utility: ensure sample image exists for upload ---
def _ensure_sample_image() -> str:
    """Create a tiny PNG in project dir if UPLOAD_IMAGE_PATH not set."""
    upload_path = os.environ.get('UPLOAD_IMAGE_PATH')
    if upload_path and os.path.isfile(upload_path):
        return upload_path
    # create sample.png in runtime dir
    sample_path = os.path.join(os.getcwd(), 'sample.png')
    if not os.path.isfile(sample_path):
        # 1x1 white png base64
        pixel_b64 = (
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABAABJzQnCgAAAABJRU5ErkJggg=='
        )
        with open(sample_path, 'wb') as f:
            f.write(base64.b64decode(pixel_b64))
    os.environ['UPLOAD_IMAGE_PATH'] = sample_path
    return sample_path

_SAMPLE_IMAGE_PATH = _ensure_sample_image()

async def force_window_activation(page: Page, maximize: bool = False, flash_maximize: bool = False):
    """
    Force browser window activation using gentle methods.
    maximize: ウィンドウを最大化する
    flash_maximize: 一瞬最大化してから元に戻す（UI再描画のため）
    """
    try:
        # ウィンドウフォーカス
        await page.evaluate("""
        window.focus();
        """)
        
        # マウスの移動でフォーカスを促す
        await page.mouse.move(100, 100)
        
        # 画面サイズを取得・保存
        if flash_maximize:
            original_size = await page.evaluate("""
            () => {
                return {
                    width: window.outerWidth,
                    height: window.outerHeight,
                    left: window.screenX,
                    top: window.screenY
                };
            }
            """)
            
            # 一瞬最大化
            await page.evaluate("""
            () => {
                window.moveTo(0, 0);
                window.resizeTo(window.screen.width, window.screen.height);
                console.log('Window temporarily maximized for UI refresh');
            }
            """)
            
            # 少し待つ
            await page.wait_for_timeout(500)
            
            # 元のサイズに戻す
            await page.evaluate("""
            (size) => {
                window.resizeTo(size.width, size.height);
                window.moveTo(size.left, size.top);
                console.log('Window restored to original size');
            }
            """, original_size)
            
            Actor.log.info("Window flash-maximized to refresh UI")
        
        # 必要に応じてウィンドウを最大化
        elif maximize:
            await page.evaluate("""
            if (window.screen && window.outerHeight < window.screen.height) {
                window.moveTo(0, 0);
                window.resizeTo(window.screen.width, window.screen.height);
                console.log('Window maximized via JavaScript');
            }
            """)
            Actor.log.info("Window maximized for better visibility")
        
        Actor.log.info("Used window activation methods")
    except Exception as e:
        Actor.log.error(f"Error while trying to activate window: {str(e)}")

async def retry_click(element: ElementHandle, page: Page = None, selector: str = None, max_attempts: int = 3):
    """
    Retry clicking an element with multiple methods if needed.
    """
    # 文字列の場合は、要素を再取得
    if isinstance(element, str) and page and selector:
        try:
            Actor.log.info(f"Element was string, trying to get element with selector: {selector}")
            element = await page.query_selector(selector)
            if not element:
                return False
        except Exception as e:
            Actor.log.error(f"Failed to re-acquire element: {str(e)}")
            return False
    
    for attempt in range(max_attempts):
        try:
            if attempt == 0:
                # Standard click
                await element.click()
                Actor.log.info(f"Standard click successful (attempt {attempt+1})")
                return True
            elif attempt == 1:
                # Force click via JavaScript
                await element.evaluate("el => el.click()")
                Actor.log.info(f"JavaScript click successful (attempt {attempt+1})")
                return True
            else:
                # Click with position
                bbox = await element.bounding_box()
                if bbox:
                    x = bbox["x"] + bbox["width"] / 2
                    y = bbox["y"] + bbox["height"] / 2
                    page = await element.page()
                    await page.mouse.click(x, y)
                    Actor.log.info(f"Position click successful (attempt {attempt+1})")
                    return True
                
        except Exception as e:
            Actor.log.warning(f"Click attempt {attempt+1} failed: {str(e)}")
    
    return False

async def perform_button_sequence(page: Page, upload_path: str, original_filename: str):
    """
    Perform a sequence of button clicks for Vizcom AI workflow.
    
    Sequence: "New file" -> "Start in Studio" -> "Upload an image" -> "options_button"
    
    Args:
        page: Playwright page
        upload_path: Path to the image file to upload
        original_filename: Original filename of the uploaded image
        
    Returns:
        Dictionary containing results such as exported_stl_path
    """
    # 初期活性化
    await force_window_activation(page)
    
    # 結果を格納する辞書を初期化
    result_data = {}
    
    buttons_to_click = [
        {"text": "New file", "delay": 4000},
        {"text": "Start in Studio", "delay": 4000, "maximize_after": True},
        {"text": "Upload an image", "delay": 3000},
        {"text": "options_button", "delay": 6000}
    ]
    
    for button_info in buttons_to_click:
        button_text = button_info["text"]
        delay = button_info["delay"]
        maximize_after = button_info.get("maximize_after", False)
        flash_maximize = button_info.get("flash_maximize", False)
        
        try:
            Actor.log.info(f'Looking for button: "{button_text}"')
            
            # plus_buttonの場合は特別な処理
            if button_text == "plus_button":
                if flash_maximize:
                    # プラスボタン検出前に一瞬最大化して画面をリフレッシュ
                    await force_window_activation(page, flash_maximize=True)
            else:
                await force_window_activation(page)
            
            # ページが完全にロードされるのを待つ
            try:
                await page.wait_for_load_state('networkidle', timeout=5000)
            except Exception as e:
                Actor.log.warning(f'Network did not become idle: {str(e)}')
            
            # スクリーンショットを撮って現在の状態を確認
            await page.screenshot(path=f"before_finding_{button_text.replace(' ', '_')}.png")
            
            # Try different ways to find the button
            button = None
            
            # Special case for "Start in Studio" button after "New file" was clicked
            if button_text == "Start in Studio":
                Actor.log.info('Using improved detection for "Start in Studio" button')
                
                # 一瞬最大化してUIをリフレッシュ
                await force_window_activation(page, flash_maximize=True)
                
                # ページ全体の内容をデバッグ
                page_content = await page.content()
                with open("page_after_new_file.html", "w", encoding="utf-8") as f:
                    f.write(page_content)
                
                # ページ上のすべてのテキストを取得
                all_text_elements = await page.query_selector_all('h1, h2, h3, h4, h5, h6, p, span, div, button, a')
                texts = []
                for el in all_text_elements:
                    try:
                        text = await el.text_content()
                        if text and len(text.strip()) > 0:
                            texts.append((el, text.strip()))
                    except:
                        pass
                
                Actor.log.info(f'Found {len(texts)} text elements on page')
                
                # 正確に"Start in Studio"というテキストを持つ要素を探す
                exact_matches = []
                for el, text in texts:
                    if text == "Start in Studio":
                        exact_matches.append((el, text))
                
                Actor.log.info(f'Found {len(exact_matches)} exact matches for "Start in Studio"')
                
                # 正確なマッチがあればそれを使用
                if exact_matches:
                    element, text = exact_matches[0]
                    Actor.log.info(f'Using exact text match: "{text}"')
                    button = element
                
                # なければ"Start in Studio"を含む要素を探す
                if not button:
                    for el, text in texts:
                        if "Start in Studio" in text and len(text) < 30:  # 短いテキストのみ（長い複合テキストは避ける）
                            Actor.log.info(f'Found element containing "Start in Studio": "{text}"')
                            button = el
                            break
                
                # それでも見つからなければJavaScriptを使用
                if not button:
                    click_result = await page.evaluate("""
                    () => {
                        // 正確な「Start in Studio」テキストを持つ要素を探す
                        const findExactText = (selector, text) => {
                            const elements = Array.from(document.querySelectorAll(selector));
                            return elements.find(el => el.textContent.trim() === text);
                        };
                        
                        // さまざまなセレクタと方法で探す
                        let element = findExactText('a, button, div[role="button"]', 'Start in Studio');
                        if (element) {
                            element.click();
                            return `Clicked exact element with text "Start in Studio"`;
                        }
                        
                        // カードの最初のものをクリック（一般的なUI設計）
                        const cards = document.querySelectorAll('.card, [class*="card"], [class*="Card"]');
                        if (cards.length > 0) {
                            const firstCard = cards[0];
                            
                            // カード内の「Start in Studio」を探す
                            const studioText = firstCard.querySelector('*:contains("Start in Studio")');
                            if (studioText) {
                                studioText.click();
                                return `Clicked "Start in Studio" text within card`;
                            }
                            
                            // なければカード自体をクリック
                            firstCard.click();
                            return `Clicked first card element`;
                        }
                        
                        // 最後の手段：画像の直下にあるボタンやテキスト
                        const images = document.querySelectorAll('img');
                        for (const img of images) {
                            const parent = img.parentElement;
                            const siblings = parent.querySelectorAll('button, a, div[role="button"]');
                            if (siblings.length > 0) {
                                siblings[0].click();
                                return `Clicked button near image`;
                            }
                        }
                        
                        return 'No suitable elements found';
                    }
                    """)
                    Actor.log.info(f'Direct JavaScript click result: {click_result}')
                    
                    # 強制的に最大化してクリックエフェクトを安定させる
                    await force_window_activation(page, maximize=True)
                    
                    # 少し待つ
                    await page.wait_for_timeout(2000)
                    
                    # 直接JavaScript実行を追加
                    await page.evaluate("""
                    () => {
                        // Studioカードをクリック
                        const studioElements = Array.from(document.querySelectorAll('*')).filter(el => 
                            el.textContent && el.textContent.includes('Studio')
                        );
                        
                        if (studioElements.length > 0) {
                            // クリックイベントを生成
                            const event = new MouseEvent('click', {
                                view: window,
                                bubbles: true,
                                cancelable: true
                            });
                            studioElements[0].dispatchEvent(event);
                            
                            // 直接のクリックも実行
                            setTimeout(() => {
                                try { studioElements[0].click(); } catch(e) {}
                            }, 200);
                        }
                    }
                    """)
                    
                    Actor.log.info('Forced additional Studio click via JavaScript')
                    
                    # さらに待機
                    await page.wait_for_timeout(2000)
                    
                    # 次のボタンに進む
                    continue
            
            # Special case for "Create" button after "Start in Studio"
            elif button_text == "Create":
                Actor.log.info('Using enhanced detection for "Create" button')
                
                # 一瞬最大化してUIをリフレッシュ
                await force_window_activation(page, flash_maximize=True)
                await page.wait_for_timeout(1000)
                
                # まず正確なテキストで検索
                create_selectors = [
                    'button:text("Create")',
                    'button:text("CREATE")', 
                    'button:text-is("Create")',
                    'a:text("Create")',
                    'a:text-is("Create")',
                    'div[role="button"]:text("Create")'
                ]
                
                for selector in create_selectors:
                    try:
                        button = await page.query_selector(selector)
                        if button:
                            Actor.log.info(f'Found Create button with selector: {selector}')
                            break
                    except Exception as e:
                        Actor.log.warning(f'Error with selector {selector}: {str(e)}')
                
                # 見つからない場合は部分一致で検索
                if not button:
                    Actor.log.info('Trying partial matches for Create button')
                    partial_selectors = [
                        'button:has-text("Create")',
                        'a:has-text("Create")',
                        'div[role="button"]:has-text("Create")',
                        'span:has-text("Create")'
                    ]
                    
                    for selector in partial_selectors:
                        try:
                            button = await page.query_selector(selector)
                            if button:
                                Actor.log.info(f'Found Create button with partial selector: {selector}')
                                break
                        except Exception as e:
                            Actor.log.warning(f'Error with partial selector {selector}: {str(e)}')
                
                # 現在のページを保存
                page_content = await page.content()
                with open("page_after_studio.html", "w", encoding="utf-8") as f:
                    f.write(page_content)
                
                # 画面全体のスクリーンショット
                await page.screenshot(path="screen_before_create.png")
                
                # ボタンが見つからない場合はJavaScriptを使って特定のパターンを持つボタンを探す
                if not button:
                    Actor.log.info('Using JavaScript to find and click Create button')
                    
                    # JavaScriptによる最も強力な検出と強制クリック
                    js_result = await page.evaluate("""
                    () => {
                        // すべてのテキストを取得
                        const getAllText = () => {
                            return Array.from(document.querySelectorAll('*')).map(el => {
                                return el.textContent ? el.textContent.trim() : '';
                            }).filter(t => t.length > 0);
                        };
                        console.log('All text in page:', getAllText().join(' | '));
                        
                        // テキスト完全一致で探す
                        const findExactTextAndClick = (text) => {
                            const elements = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
                            const exact = elements.find(el => el.textContent && el.textContent.trim() === text);
                            if (exact) {
                                exact.click();
                                return `Clicked exact text match: ${text}`;
                            }
                            return null;
                        };
                        
                        // 最も一般的なケース - 「Create」という正確なテキストを持つボタン
                        let result = findExactTextAndClick('Create');
                        if (result) return result;
                        
                        // Createを含むボタンを探す
                        const createButtons = Array.from(document.querySelectorAll('button, a, div[role="button"]')).filter(el => 
                            el.textContent && el.textContent.toLowerCase().includes('create')
                        );
                        
                        if (createButtons.length > 0) {
                            createButtons[0].click();
                            return `Clicked button containing create: ${createButtons[0].textContent}`;
                        }
                        
                        // 主要なアクションボタンを探す（スタイルから判断）
                        const actionButtons = Array.from(document.querySelectorAll('button, a[role="button"], div[role="button"]')).filter(btn => {
                            const style = window.getComputedStyle(btn);
                            // 青/緑色の背景、白いテキスト、太字などは通常主要なアクションボタン
                            const isPrimary = 
                                style.backgroundColor.includes('rgb(0, 0') || 
                                style.backgroundColor.includes('rgb(0, 1') || 
                                style.backgroundColor.includes('rgb(0, 2') || 
                                style.backgroundColor.includes('blue') || 
                                style.backgroundColor.includes('green') ||
                                style.color === 'rgb(255, 255, 255)' || 
                                style.fontWeight === 'bold' ||
                                btn.classList.contains('primary') ||
                                btn.getAttribute('aria-label')?.includes('main');
                            
                            return isPrimary && btn.getBoundingClientRect().width > 50;
                        });
                        
                        if (actionButtons.length > 0) {
                            // 強調表示してからクリック
                            actionButtons[0].style.border = '3px solid red';
                            setTimeout(() => {
                                actionButtons[0].click();
                            }, 100);
                            return `Clicked primary action button with style detection`;
                        }
                        
                        // 最後の手段：フォーム内の送信ボタン
                        const submitButtons = document.querySelectorAll('input[type="submit"], button[type="submit"]');
                        if (submitButtons.length > 0) {
                            submitButtons[0].click();
                            return 'Clicked submit button';
                        }
                        
                        // 右下のボタンをクリック（多くのUIでアクションボタンは右下）
                        const allButtons = Array.from(document.querySelectorAll('button, a[role="button"], div[role="button"]'));
                        if (allButtons.length > 0) {
                            // 右下にあるボタンを優先
                            allButtons.sort((a, b) => {
                                const rectA = a.getBoundingClientRect();
                                const rectB = b.getBoundingClientRect();
                                // 下部にあるボタンを優先
                                const bottomDiff = rectB.bottom - rectA.bottom;
                                // ほぼ同じ高さなら右側を優先
                                if (Math.abs(bottomDiff) < 50) {
                                    return rectB.right - rectA.right;
                                }
                                return bottomDiff;
                            });
                            
                            allButtons[0].click();
                            return `Clicked rightmost bottom button as fallback`;
                        }
                        
                        return 'No suitable Create button found';
                    }
                    """)
                    
                    Actor.log.info(f'JavaScript Create button search: {js_result}')
                    
                    # スクリーンショット
                    await page.screenshot(path="after_js_create_button.png")
                    
                    # ウィンドウを最大化して活性化
                    await force_window_activation(page, maximize=True)
                
                # プラスボタンが既に表示されているかチェック
                plus_visible = await page.evaluate("""
                () => {
                    // プラスアイコンのSVGパスを持つボタンをチェック
                    const plusButtons = document.querySelectorAll('button svg path[d*="M8 2v12"]');
                    if (plusButtons.length > 0) return true;
                    
                    // クラス名でチェック
                    const styledButtons = document.querySelectorAll('button.hynoDj, button[class*="hynoDj"]');
                    if (styledButtons.length > 0) return true;
                    
                    return false;
                }
                """)
                
                if plus_visible:
                    Actor.log.info('Plus button already visible, skipping Create and moving to next step')
                    # 次のステップ（プラスボタン）に進むためにCreateをスキップ
                    continue
                
                # 少し待機してから次のステップに進む
                await page.wait_for_timeout(delay)
            
            # Special case for Upload an image (direct button)
            elif button_text == "Upload an image":
                Actor.log.info('Handling direct "Upload an image" button')

                # locate button by text
                upload_selectors = [
                    'button:has-text("Upload an image")',
                    'a:has-text("Upload an image")',
                    'div[role="button"]:has-text("Upload an image")'
                ]
                for selector in upload_selectors:
                    try:
                        element = await page.query_selector(selector)
                        if element:
                            button = element
                            Actor.log.info(f'Found Upload button with selector: {selector}')
                            break
                    except Exception:
                        pass

                if not button:
                    Actor.log.warning('Could not find Upload button, skipping')
                    continue

                # Expect file chooser and upload file
                try:
                    async with page.expect_file_chooser() as fc_info:
                        await retry_click(button)
                    file_chooser = await fc_info.value
                    await file_chooser.set_files(upload_path)
                    Actor.log.info(f'Uploaded file: {upload_path}')

                    # wait for network idle indicating upload done
                    try:
                        await page.wait_for_load_state('networkidle', timeout=10000)
                    except Exception:
                        pass
                    await page.screenshot(path="after_direct_upload.png")
                except Exception as up_err:
                    Actor.log.error(f'Upload via file chooser failed: {str(up_err)}')

                # After upload, wait and continue
                await page.wait_for_timeout(delay)
                continue
            
            # Handle options_button (three dots)
            elif button_text == "options_button":
                Actor.log.info('Looking for three-dots options button')

                # selectors for three-dots button
                dots_selectors = [
                    'button ddzEaA',
                    'button:has(svg path[d^="M12.528 8"])',
                    'button[data-state="closed"]:not(.hynoDj)',
                ]

                for sel in dots_selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            button = el
                            Actor.log.info(f'Found options button via {sel}')
                            break
                    except Exception:
                        pass

                if not button:
                    Actor.log.warning('Options button not found, skipping')
                    continue

                # 1) hover entire row to reveal hidden menu trigger
                try:
                    row_handle = await button.evaluate_handle('el => el.closest("li, div[class*=\"sc-\"]")')
                    if row_handle:
                        bb_row = await row_handle.bounding_box()
                        if bb_row:
                            await page.mouse.move(bb_row["x"] + bb_row["width"] / 2, bb_row["y"] + bb_row["height"] / 2)
                            await page.wait_for_timeout(250)
                except Exception:
                    pass

                # 2) single click to open menu, avoid double clicking which may close it
                menu_open = False
                try:
                    await retry_click(button)
                    # wait for menu item to appear
                    try:
                        await page.wait_for_selector('button[role="menuitem"]', timeout=1500)
                        menu_open = True
                    except Exception:
                        pass
                except Exception as click_err:
                    Actor.log.warning(f'Single click on options button failed: {str(click_err)}')
                
                # 3) Force menu visibility via CSS in case it rendered hidden
                try:
                    await page.evaluate("""
                    () => {
                        const menu = document.querySelector('div[role="menu"], [data-radix-popper-content-wrapper]');
                        if (menu) {
                            menu.style.display = 'block';
                            menu.style.opacity = '1';
                            menu.style.maxHeight = '1000px';
                            menu.style.overflow = 'visible';
                            menu.style.pointerEvents = 'auto';
                        }
                    }
                    """)
                    Actor.log.info('Forced options dropdown visibility')
                except Exception as vis_err:
                    Actor.log.warning(f'Error forcing dropdown visibility: {str(vis_err)}')

                # 4) Click "Generate 3D" item inside the dropdown (after ensuring menu open)
                try:
                    gen_sel = 'button[role="menuitem"]:has-text("Generate 3D")'
                    gen_btn = await page.query_selector(gen_sel)
                    if gen_btn:
                        Actor.log.info('Found "Generate 3D" menu item, clicking')
                        await retry_click(gen_btn)
                        await page.wait_for_timeout(500)
                        # ----- NEW: wait for generation and export -----
                        export_result = await _handle_generation_and_export(page, original_filename)
                        # Store result data for later use
                        if isinstance(export_result, dict):
                            result_data.update(export_result)
                    else:
                        if not menu_open:
                            # If menu item not found, try clicking button again once more
                            try:
                                await retry_click(button)
                                await page.wait_for_selector(gen_sel, timeout=1000)
                                gen_btn = await page.query_selector(gen_sel)
                                if gen_btn:
                                    await retry_click(gen_btn)
                                    Actor.log.info('Generate 3D clicked after second attempt')
                                else:
                                    Actor.log.warning('Generate 3D menu item still not found')
                            except Exception:
                                Actor.log.warning('Second attempt to open menu failed')
                        else:
                            Actor.log.warning('Generate 3D menu item not found')
                except Exception as g3_err:
                    Actor.log.warning(f'Error clicking Generate 3D: {str(g3_err)}')

                await page.screenshot(path="after_options_button.png")
                continue
            
            else:
                # Method 1: Try to find by text content with XPath (most robust)
                try:
                    xpath_expressions = [
                        f'//button[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "{button_text.lower()}")]',
                        f'//div[@role="button" and contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "{button_text.lower()}")]',
                        f'//a[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "{button_text.lower()}")]',
                        f'//span[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "{button_text.lower()}")]',
                        f'//*[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "{button_text.lower()}") and (self::button or self::a or self::div[@role="button"] or (self::span and not(ancestor::button) and not(ancestor::a)))]'
                    ]
                    
                    for xpath in xpath_expressions:
                        element = await page.query_selector(f'xpath={xpath}')
                        if element:
                            button = element
                            Actor.log.info(f'Found "{button_text}" via XPath: {xpath}')
                            break
                except Exception as e:
                    Actor.log.warning(f'XPath search error: {str(e)}')
            
            # If button still not found, debug and continue
            if not button:
                Actor.log.info(f'Button "{button_text}" not found, taking screenshot for debugging')
                
                try:
                    await page.screenshot(path=f"button_{button_text.replace(' ', '_')}_not_found.png")
                    
                    # Save the HTML content for offline analysis
                    html_content = await page.content()
                    with open(f"page_when_{button_text.replace(' ', '_')}_not_found.html", "w", encoding="utf-8") as f:
                        f.write(html_content)
                except Exception as debug_err:
                    Actor.log.error(f'Debug screenshot/HTML save error: {str(debug_err)}')
                    
                Actor.log.info(f'Button "{button_text}" not found, skipping this step')
                continue
            
            # Click the button using our retry function
            Actor.log.info(f'Attempting to click "{button_text}"')
            
            # 特別な処理: plus_buttonの場合は追加情報を渡す
            if button_text == "plus_button":
                selector = 'button[class*="hynoDj"], button[data-state="closed"]'
                click_success = await retry_click(button, page, selector)
            else:
                click_success = await retry_click(button)
            
            if not click_success:
                Actor.log.error(f'All click attempts failed for "{button_text}"')
                continue
            
            # Special handling for "Start in Studio" button - click twice due to UI issues
            if button_text == "Start in Studio":
                Actor.log.info(f'UI issue detected: Clicking "{button_text}" again after a short delay')
                await page.wait_for_timeout(1000)  # Short wait between clicks
                await retry_click(button)
                
                # Take a screenshot after the second click
                await page.screenshot(path=f"after_second_click_{button_text.replace(' ', '_')}.png")
                
                if maximize_after:
                    # ウィンドウを最大化して活性化
                    await force_window_activation(page, maximize=True)
                    Actor.log.info('Window maximized after Start in Studio double-click')
            
            # Wait for the page to respond
            Actor.log.info(f'Waiting {delay}ms after clicking "{button_text}"')
            await page.wait_for_timeout(delay)
            
            # Take a screenshot after clicking
            try:
                await page.screenshot(path=f"after_{button_text.replace(' ', '_')}.png")
            except Exception as ss_err:
                Actor.log.warning(f'Screenshot error: {str(ss_err)}')
            
        except Exception as e:
            Actor.log.error(f'Error clicking "{button_text}": {str(e)}')
            try:
                await page.screenshot(path=f"error_{button_text.replace(' ', '_')}.png")
            except Exception as ss_err:
                Actor.log.warning(f'Error screenshot failed: {str(ss_err)}')

    # 処理結果を返す
    return result_data

# --- New utility: wait for 3-D generation completion and export STL ---
async def _wait_for_new_layer(page: Page, original_filename: str, max_wait_ms: int = 300_000) -> ElementHandle | None:
    """Wait until the 3-D generated layer appears and return its row element.

    Vizcom inserts the new 3-D layer at the TOP of the layer list, above the original
    2-D image (sample.png).  Once at least two rows are present, we pick the first
    row that is *not* the original uploaded image filename.
    """
    try:
        await page.wait_for_function(
            """
            (nameLower) => {
                const rows = document.querySelectorAll('li .sc-KxFZn.hoverable');
                if (rows.length < 2) return false;
                for (const row of rows) {
                    const txt = row.innerText.toLowerCase();
                    if (txt.includes('- 3d') || txt.includes(' 3d') || !txt.includes(nameLower)) {
                        return true;
                    }
                }
                return false;
            }
            """,
            arg=original_filename.lower(),
            timeout=max_wait_ms,
        )

        rows = await page.query_selector_all('li .sc-KxFZn.hoverable')
        for row in rows:
            try:
                txt_full_py = await row.inner_text()
            except Exception:
                txt_full_py = ""
            txt_low = txt_full_py.lower()
            if "- 3d" in txt_low or " 3d" in txt_low:
                return row

        # Fallback to row that is not the original uploaded file name
        for row in rows:
            try:
                txt = (await row.inner_text()).lower()
            except Exception:
                txt = ""
            if original_filename.lower() not in txt:
                return row
    except Exception as e:
        Actor.log.warning(f"Timed-out waiting for new 3-D layer: {e}")
    return None

async def _wait_until_layer_ready(page: Page, layer_el: ElementHandle, max_wait_ms: int = 240_000):
    """Wait until generation progress hits 100 % or spinner/check-mark indicates completion."""
    try:
        await page.wait_for_function(
            """
            (el) => {
                // Global toast still showing loading?
                if (document.body.innerText.includes('Loading 3D model')) return false;

                // Spinner still inside this row?
                const spinner = el.querySelector('svg[style*="animation"], svg.animate-spin');
                if (spinner) return false;

                // Check for ready cues
                const txt = el.innerText.toLowerCase();
                const has3dLabel = txt.includes('- 3d') || txt.includes(' 3d');
                const hasMeshIcon = !!el.querySelector('svg path[d*="8.127"], svg[class^="sc-evzXkX"], svg[class*=" sc-evzXkX"]');
                const hasCheck = !!el.querySelector('svg path[d*="M13.5"], svg path[d*="l.475"]');

                return has3dLabel && (hasMeshIcon || hasCheck);
            }
            """,
            arg=layer_el,
            timeout=max_wait_ms,
        )
    except Exception as e:
        Actor.log.warning(f"Layer did not report ready state in time: {e}")

async def _export_layer_as_glb(page: Page, layer_el: ElementHandle, max_attempts: int = 10, result_data: dict = None):
    """Open the 3-dot menu for the provided layer row and click Export → GLB."""
    # Dictionary to store results across the function
    if result_data is None:
        result_data = {}
    
    async def _layer_ready_and_row() -> tuple[bool, ElementHandle | None]:
        """Return readiness boolean and the **current** ready layer row (handle may update after React re-renders)."""
        return await page.evaluate_handle(
            """
            () => {
                const result = { ready: false, row: null };

                // Abort if loading toast visible
                if (document.body.innerText.includes('Loading 3D model')) return result;

                const rows = Array.from(document.querySelectorAll('li .sc-KxFZn.hoverable'));
                for (const row of rows) {
                    const txt = row.innerText.toLowerCase();
                    const has3dLabel = txt.includes('- 3d') || txt.includes(' 3d');

                    if (!has3dLabel) continue;

                    // Not ready if spinner still exists
                    if (row.querySelector('svg[style*="animation"], svg.animate-spin')) continue;

                    const hasMesh = !!row.querySelector('svg path[d*="8.127"], svg[class^="sc-evzXkX"], svg[class*=" sc-evzXkX"]');
                    const hasCheck = !!row.querySelector('svg path[d*="M13.5"], svg path[d*="l.475"]');

                    if (hasMesh || hasCheck) {
                        result.ready = true;
                        result.row = row;
                        break;
                    }
                }
                return result;
            }
            """
        )

    async def _try_get_ready_row() -> ElementHandle | None:
        ok_row = None
        try:
            handle = await _layer_ready_and_row()
            ready_bool = await handle.evaluate("res => res.ready")
            if ready_bool:
                # Get element handle back from JS object
                ok_row = await handle.evaluate_handle("res => res.row")
        except Exception:
            pass
        return ok_row

    for attempt in range(1, max_attempts + 1):
        # Skip until layer really ready
        try:
            layer_el_current = await _try_get_ready_row()
            if not layer_el_current:
                Actor.log.info(f"[Export attempt {attempt}] 3-D layer still processing – waiting…")
                await page.wait_for_timeout(5000)
                continue
            else:
                layer_el = layer_el_current  # update to latest DOM node
        except Exception as chk_err:
            Actor.log.warning(f"Readiness check error: {chk_err}")
            await page.wait_for_timeout(5000)
            continue

        try:
            # Hover row each loop to ensure menu button visible
            try:
                bb = await layer_el.bounding_box()
                if bb:
                    await page.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
                    await page.wait_for_timeout(200)
            except Exception:
                pass

            # find three-dots
            dots_btn = None
            for sel in [
                'button.ddzEaA',
                'button:has(svg path[d^="M12.528 8"])',
                'button[data-state="closed"]:not(.hynoDj)',
            ]:
                dots_btn = await layer_el.query_selector(sel)
                if dots_btn:
                    break

            if not dots_btn:
                Actor.log.warning("[Export attempt %d] 3-dot button not found" % attempt)
                await page.wait_for_timeout(2000)
                continue

            await retry_click(dots_btn)

            # wait for menu items
            try:
                await page.wait_for_selector('button[role="menuitem"]', timeout=2000)
            except Exception:
                pass

            export_btn = await page.query_selector('button[role="menuitem"]:has-text("Export")')
            if export_btn:
                await retry_click(export_btn)

                # Wait for the export overlay / submenu containing GLB
                try:
                    await page.wait_for_selector(':text("GLB")', timeout=5000)
                except Exception:
                    Actor.log.info("GLB label not yet visible after Export click; will retry…")

            # Try to locate GLB option in the newly opened overlay / submenu
            glb_selectors = [
                'button[role="menuitem"]:has-text("GLB")',
                'div[role="menuitem"]:has-text("GLB")',
                'li[role="menuitem"]:has-text("GLB")',
                'button:has-text("GLB")',
                'div:has-text("GLB")',
                ':text("GLB")'
            ]
            glb_btn = None
            for ss in glb_selectors:
                try:
                    glb_btn = await page.query_selector(ss)
                    if glb_btn:
                        break
                except Exception:
                    pass

            if not glb_btn:
                Actor.log.warning("[Export attempt %d] GLB option still not found; will retry…" % attempt)
                # Close export submenu by pressing Escape to reset state
                try:
                    await page.keyboard.press('Escape')
                except Exception:
                    pass
                await page.wait_for_timeout(5000)
                continue

            # Click GLB option and capture download
            download_success = False
            try:
                async with page.expect_download(timeout=30000) as dl_info:
                    await retry_click(glb_btn)
                download = await dl_info.value

                # 固定のファイル名を使用
                file_name = "exported.glb"
                save_path = os.path.join(os.getcwd(), file_name)
                await download.save_as(save_path)
                Actor.log.info(f"Downloaded GLB to {save_path}")

                # Store the path for later reference
                result_data['exported_glb_path'] = save_path

                # Optionally push to default key-value store for Apify dataset
                try:
                    with open(save_path, "rb") as f:
                        file_content = f.read()  # ファイルをバイト配列として読み込む
                        # キー名も「exported.glb」に固定
                        await Actor.set_value("exported.glb", file_content, content_type="model/gltf-binary")
                        Actor.log.info(f"GLB file saved to key-value store with key: exported.glb")
                except Exception as e:
                    Actor.log.error(f"Failed to save GLB to key-value store: {e}")

                download_success = True
            except Exception as dl_err:
                Actor.log.warning(f"Download capture or save failed: {dl_err}")

            # Fallback: if menu closes without download and no error toast, assume not ready
            if not download_success:
                Actor.log.info(f"[Export attempt {attempt}] Export did not complete yet – retrying…")
                # Close any overlay still open
                try:
                    await page.keyboard.press('Escape')
                except Exception:
                    pass
                await page.wait_for_timeout(5000)
                continue

            # If we reach here, download succeeded
            await page.screenshot(path="after_export_glb.png")
            return result_data
        except Exception as exp_err:
            Actor.log.warning(f"Export attempt {attempt} failed: {exp_err}")

    Actor.log.warning("Failed to export GLB after multiple attempts")
    return result_data

async def _handle_generation_and_export(page: Page, original_filename: str):
    """Detect new 3-D layer then try exporting it repeatedly until GLB becomes available."""
    result_data = {}
    
    Actor.log.info("Waiting for new 3-D layer to appear…")
    new_layer = await _wait_for_new_layer(page, original_filename)
    if not new_layer:
        Actor.log.warning("Failed to detect new 3-D layer – aborting export")
        return result_data
    
    # Focus/click the layer (harmless even if still processing)
    try:
        await retry_click(new_layer)
    except Exception:
        pass
    
    # Keep retrying export – the helper has its own patience
    await _export_layer_as_glb(page, new_layer, max_attempts=60, result_data=result_data)
    return result_data

async def main() -> None:
    """Launch browser and login to Vizcom.ai."""
    # コマンドライン引数をパース
    args = parse_args()
    
    # セットアップロギング
    logger = setup_logging(args.debug or True)  # デバッグモードを強制的に有効化
    logger.info("Starting Vizcom 3D generator")
    
    # Enter the context of the Actor.
    async with Actor as actor:
        try:
            # Get Actor input (command line args take precedence)
            actor_input = await actor.get_input() or {}
            if args.imageUrl:
                actor_input['imageUrl'] = args.imageUrl
                logger.info(f"Using image URL from command line: {args.imageUrl}")
            
            logger.info(f"Input configuration: {json.dumps(actor_input, indent=2)}")
            
            if not actor_input.get('imageUrl') and not os.environ.get('UPLOAD_IMAGE_PATH'):
                logger.info("No image URL specified, will use sample image")
            
            # Prepare the image for upload
            upload_path, original_filename = await _prepare_image_for_upload(actor_input)
            logger.info(f"Will use image: {upload_path} (original name: {original_filename})")
            
            # 画像が存在することを確認
            if os.path.exists(upload_path):
                logger.info(f"Confirmed image exists at: {upload_path}, size: {os.path.getsize(upload_path)} bytes")
            else:
                logger.error(f"Image file does not exist at: {upload_path}. This is a critical error.")
                await actor.fail()
                return
            
            # Check Vizcom credentials
            email = os.environ.get('VISCOM_USER')
            password = os.environ.get('VISCOM_PASSWORD')
            
            if not email or not password:
                logger.warning("Vizcom credentials not found in environment variables!")
                logger.info("Make sure to set VISCOM_USER and VISCOM_PASSWORD environment variables")
                
            target_url = 'https://app.vizcom.ai/auth'
            
            logger.info(f'Launching browser to access {target_url}')
            headless = actor.config.headless
            logger.info(f'Browser headless mode: {headless}')

            # 結果を保存するための辞書を初期化
            result_data = {}
            
            # Launch Playwright and open a new browser context.
            async with async_playwright() as playwright:
                # Try Firefox instead of Chromium for better compatibility
                browser = await playwright.firefox.launch(
                    headless=actor.config.headless,  # Use Actor config for headless mode
                    args=['--start-maximized', '--disable-dev-shm-usage']  # Additional arguments for stability
                )
                
                # Create a context with specific settings for better compatibility
                context = await browser.new_context(
                    viewport={'width': 1280, 'height': 800},
                    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
                    ignore_https_errors=True
                )
                
                # Disable WebGL which is causing errors
                await context.add_init_script("""
                    // Override WebGL
                    Object.defineProperty(navigator, 'webdriver', {get: () => false});
                    Object.defineProperty(window, 'WebGLRenderingContext', {get: () => null});
                    Object.defineProperty(window, 'WebGL2RenderingContext', {get: () => null});
                """)
                
                # Create a new page
                page = await context.new_page()
                
                # Enable more verbose logging for debugging
                page.on("console", lambda msg: Actor.log.info(f"BROWSER CONSOLE: {msg.text}"))
                page.on("pageerror", lambda err: Actor.log.error(f"BROWSER ERROR: {err}"))
                
                Actor.log.info(f'Navigating to {target_url}...')
                
                # Navigate to the target URL
                try:
                    response = await page.goto(target_url, timeout=60000, wait_until="domcontentloaded")
                    Actor.log.info(f'Page loaded with status: {response.status if response else "unknown"}')
                except Exception as e:
                    Actor.log.error(f'Error during page navigation: {str(e)}')
                
                # Wait a moment for JavaScript to execute
                Actor.log.info('Waiting for page to stabilize...')
                await page.wait_for_timeout(5000)
                
                # Attempt to login
                try:
                    # Get credentials from environment variables
                    email = os.environ.get('VISCOM_USER')
                    password = os.environ.get('VISCOM_PASSWORD')
                    
                    if not email or not password:
                        Actor.log.error('Login credentials not found in environment variables!')
                        Actor.log.info('Checking environment variables:')
                        for env_var in os.environ:
                            if 'VIS' in env_var or 'USER' in env_var or 'PASS' in env_var or 'AUTH' in env_var:
                                Actor.log.info(f'Found relevant environment variable: {env_var}')
                    else:
                        Actor.log.info(f'Found credentials in environment variables. Email length: {len(email)}, Password length: {len(password)}')
                        Actor.log.info('Checking for login form...')
                        
                        # Take screenshot for debugging
                        await page.screenshot(path="auth_page.png")
                        Actor.log.info('Screenshot saved as auth_page.png')
                        
                        # 最もシンプルなアプローチでログインを試みる
                        try:
                            # 直接入力を試みる - ピュアなPlaywright方式
                            email_input = await page.query_selector('input[type="email"]')
                            password_input = await page.query_selector('input[type="password"]')
                            
                            if email_input and password_input:
                                # 入力要素が見つかった
                                Actor.log.info('Found email and password inputs')
                                
                                # メールを入力
                                await email_input.fill(email)
                                Actor.log.info('Filled email field')
                                
                                # パスワードを入力
                                await password_input.fill(password)
                                Actor.log.info('Filled password field')
                                
                                # Enterキーでフォーム送信
                                await password_input.press('Enter')
                                Actor.log.info('Pressed Enter to submit form')
                                
                                # 送信後の遷移を待機
                                await page.wait_for_timeout(5000)
                                
                                # URL確認
                                current_url = page.url
                                Actor.log.info(f'URL after form submission: {current_url}')
                                
                                if 'auth' not in current_url:
                                    Actor.log.info('Login seems successful')
                                    login_success = True
                                else:
                                    # まだ認証ページにいる場合は手動ログイン時間を与える
                                    Actor.log.info('Still on auth page - please login manually within 60 seconds')
                                    await page.screenshot(path="manual_login.png")
                                    await page.wait_for_timeout(60000)
                                    login_success = 'auth' not in page.url
                            else:
                                Actor.log.warning('Could not find email or password inputs')
                                Actor.log.info('Giving time for manual login (60 seconds)')
                                await page.screenshot(path="login_manual.png")
                                await page.wait_for_timeout(60000)
                                login_success = 'auth' not in page.url
                        except Exception as e:
                            Actor.log.error(f'Error during login process: {str(e)}')
                            # エラーが発生した場合も手動ログインの時間を与える
                            Actor.log.info('Please login manually within 60 seconds')
                            await page.screenshot(path="login_error.png")
                            await page.wait_for_timeout(60000)
                            login_success = 'auth' not in page.url
                        
                        # Start the button sequence if we're logged in
                        if login_success or 'auth' not in page.url:
                            Actor.log.info(f'After login, current URL: {page.url}')
                            # Start clicking the sequence of buttons with our prepared image
                            result_data = await perform_button_sequence(page, upload_path, original_filename)
                        else:
                            Actor.log.error('Could not complete the login process.')
                
                except Exception as e:
                    Actor.log.error(f'Error during login process: {str(e)}')
                
                # When running as a regular Actor, we don't want to keep the browser running
                await browser.close()
                logger.info("Browser closed")
                
                # Check if we have successfully exported the GLB file
                exported_glb_path = result_data.get('exported_glb_path')
                if exported_glb_path and os.path.exists(exported_glb_path):
                    logger.info(f"Successfully exported GLB to: {exported_glb_path}")
                    
                    # Add the output to Actor's output
                    try:
                        output = {
                            'status': 'success',
                            'exportedGlbPath': exported_glb_path,
                            'originalFilename': original_filename,
                            'resultUrl': f"https://api.apify.com/v2/key-value-stores/{actor.config.default_key_value_store_id}/records/exported.glb"
                        }
                        await actor.set_value('OUTPUT', output)
                    except Exception as e:
                        logger.error(f"Failed to set actor output: {e}")
                else:
                    logger.error("Failed to export GLB file")
                    # 引数なしで呼び出す
                    await actor.fail()
                    
        except Exception as e:
            logger.error(f"Actor failed with error: {e}")
            import traceback
            traceback.print_exc()
            # 非同期関数なのでawaitが必要
            await actor.fail()

# Script entry point
if __name__ == "__main__":
    try:
        import asyncio
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        import traceback
        print(f"Error: {e}")
        traceback.print_exc()
        sys.exit(1)


// Firebase Configuration (DO NOT modify these values directly if they are sensitive)
const firebaseConfig = {
    apiKey: "AIzaSyDR2OugzoVNnKN6OUKsPxC9ajldlhanteE",
    authDomain: "tournament-af6dd.firebaseapp.com",
    projectId: "tournament-af6dd",
    storageBucket: "tournament-af6dd.firebasestorage.app",
    messagingSenderId: "726964405659",
    appId: "1:726964405659:web:d03f72c2d6f8721bc98d3e",
    measurementId: "G-GK0JNQ44N7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Global variables
let currentUserData = null;
let pendingAction = null;
let unreadNotificationsCount = 0;
let videoRewardTimer = null;
let userSubmittedGamesListener = null;

// NEW FEATURE: Global object to store app feature lock controls
let appFeatureControls = {
    add_money: { locked: false, reason: '' },
    withdraw_money: { locked: false, reason: '' },
    add_game: { locked: false, reason: '' }
};

// Dynamic app settings (from Firebase)
let adminDepositNumber = '03105784772';
let minWithdrawalAmount = 1200;
let referralBonusAmount = 500;
let signupBonusAmount = 1200;
let bannerAutoplayDelay = 3000; // NEW: Default banner autoplay delay

// Home Page specific global variables for dynamic loading
let allApprovedGames = [];
let gamesByCategory = {};
let displayedCategories = [];
const CATEGORY_CHUNK_SIZE = 1;
const GAME_CHUNK_SIZE = 4;
let gamesDisplayedPerCategory = {};

let searchResults = [];
const SEARCH_RESULT_CHUNK_SIZE = 20;
let searchGamesDisplayed = 0;

// NEW: Global variables for banners
let allGeneralBanners = [];
let generalBannerSwiperInstance = null; // To store the Swiper instance for general banners

// NEW: Global variables for YouTube banners
let allYouTubeBanners = [];
let youtubeBannerSwiperInstance = null; // To store the Swiper instance for YouTube banners

// NEW: Global variables for Dramas
let allDramas = [];
let dramaSwiperInstance = null; // To store the Swiper instance for dramas

// Currency exchange rates (from Firebase)
let exchangeRates = {
    'PKR_to_INR': 0.3, 'PKR_to_USD': 0.0035,
    'INR_to_PKR': 3.33, 'INR_to_USD': 0.012,
    'USD_to_PKR': 280, 'USD_to_INR': 83
};


/**
 * Navigates to a specified page and updates the navigation bar.
 * @param {string} pageId - The ID of the page to navigate to.
 * @param {object} [data=null] - Optional data to pass to the rendering function.
 */
function navigateTo(pageId, data = null) {
    if (videoRewardTimer) {
        clearInterval(videoRewardTimer);
        videoRewardTimer = null;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageElement = document.getElementById(pageId);
    if(pageElement) {
        pageElement.classList.add('active');
        loadPageContent(pageId, data);
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        const isActive = item.getAttribute('onclick').includes(pageId);
        item.className = 'nav-item text-center transition-all duration-300';
        const isNotificationNav = item.querySelector('.fa-bell');

        if (isActive) {
            item.classList.add('text-white', 'scale-125', '-translate-y-1', 'font-bold', 'drop-shadow-md');
        } else {
            item.classList.add('text-white/60', 'scale-100');
        }

        const notificationBadge = document.getElementById('unread-notifications-count');
        if (isNotificationNav && notificationBadge) {
            if (unreadNotificationsCount > 0) {
                notificationBadge.textContent = unreadNotificationsCount;
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
    });
    window.scrollTo(0, 0);
}

/**
 * Displays a toast message.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - Whether the message is an error.
 */
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `fixed top-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg ${isError ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-green-500 to-green-600'}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

/**
 * Formats a number as a currency string.
 * @param {number} amount - The amount to format.
 * @param {string} currencyCode - The currency code (e.g., 'PKR', 'INR', 'USD').
 * @returns {string} The formatted currency string.
 */
function formatCurrency(amount, currencyCode) {
    switch (currencyCode) {
        case 'PKR': return `Rs ${new Intl.NumberFormat('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 2}).format(amount)}`;
        case 'INR': return `₹${new Intl.NumberFormat('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 2}).format(amount)}`;
        case 'USD': return `$${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(amount)}`;
        default: return `${currencyCode} ${new Intl.NumberFormat(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(amount)}`;
    }
}

/**
 * Formats a number into "Crore" or "Lakh" for views count.
 * @param {number} views - The raw views count.
 * @returns {string} Formatted views string.
 */
function formatViewsCount(views) {
    if (views >= 10000000) { // 1 Crore = 10,000,000
        return `${(views / 10000000).toFixed(1)} Crore`;
    } else if (views >= 100000) { // 1 Lakh = 100,000
        return `${(views / 100000).toFixed(1)} Lakh`;
    } else if (views >= 1000) {
        return `${(views / 1000).toFixed(1)}K`;
    }
    return String(views);
}


/**
 * Toggles the visibility of a modal.
 * @param {string} modalId - The ID of the modal to toggle.
 * @param {boolean} show - True to show, false to hide.
 */
function toggleModal(modalId, show) {
    document.getElementById(modalId).classList.toggle('active', show);
}

/**
 * Checks if the user is logged in before proceeding with an action.
 * If not logged in, opens the auth modal and queues the action.
 * @param {Event} event - The DOM event that triggered the action.
 * @param {string} actionType - The type of action to perform ('playGameUrl', 'joinTournament', 'openBannerLink', 'openYouTubeBannerVideo', 'openDramaVideoPlayer').
 * @param {...any} args - Arguments to pass to the action function.
 */
function checkLoginAndAct(event, actionType, ...args) {
    event.preventDefault();

    if (!auth.currentUser) {
        pendingAction = { type: actionType, args: args };
        toggleModal('authModal', true);
        return;
    }

    if (actionType === 'playGameUrl') {
        playGameUrl(...args);
    } else if (actionType === 'joinTournament') {
        joinTournament(event, ...args);
    } else if (actionType === 'openBannerLink') {
        openBannerLink(...args);
    } else if (actionType === 'openYouTubeBannerVideo') {
        playYouTubeBannerVideo(...args);
    } else if (actionType === 'openDramaVideoPlayer') { // NEW: Handle drama video player action
        openDramaVideoPlayer(...args);
    }
}

/**
 * Helper to get user's balance in a specific currency or preferred currency, formatted.
 * @param {string} [currency=currentUserData?.preferred_currency || 'PKR'] - The currency code.
 * @returns {string} Formatted balance string.
 */
function getFormattedBalance(currency = null) {
    if (!currentUserData || !currentUserData.wallet) {
        return formatCurrency(0, 'PKR');
    }
    const targetCurrency = currency || currentUserData.preferred_currency || 'PKR';
    const balance = currentUserData.wallet[targetCurrency] || 0;
    return formatCurrency(balance, targetCurrency);
}


/**
 * Firebase Authentication state change listener.
 */
auth.onAuthStateChanged(async user => {
    const showAppControls = !!user;
    document.getElementById('app-header').style.display = showAppControls ? 'flex' : 'none';
    document.getElementById('user-bottom-nav').style.display = showAppControls ? 'block' : 'none';

    // Fetch app settings and exchange rates regardless of login state
    try {
        const appSettingsSnap = await db.ref('app_settings').once('value');
        const appSettings = appSettingsSnap.val();
        if (appSettings) {
            adminDepositNumber = appSettings.adminDepositNumber || adminDepositNumber;
            minWithdrawalAmount = appSettings.minWithdrawalAmount || minWithdrawalAmount;
            referralBonusAmount = appSettings.referralBonusAmount || referralBonusAmount;
            signupBonusAmount = appSettings.signupBonusAmount || signupBonusAmount;
            bannerAutoplayDelay = appSettings.bannerAutoplayDelay || bannerAutoplayDelay; // NEW: Get banner autoplay delay
            const adminDepositNumEl = document.getElementById('admin-deposit-number');
            if (adminDepositNumEl) adminDepositNumEl.textContent = adminDepositNumber;
            const withdrawAmountInput = document.getElementById('withdraw-amount');
            if (withdrawAmountInput) withdrawAmountInput.placeholder = `Enter amount min ${minWithdrawalAmount}`;
            const referralBonusTextEl = document.getElementById('referral-bonus-text');
            if (referralBonusTextEl) referralBonusTextEl.textContent = referralBonusAmount;
        }

        const exchangeRatesSnap = await db.ref('exchange_rates').once('value');
        if (exchangeRatesSnap.exists()) {
            exchangeRates = { ...exchangeRates, ...exchangeRatesSnap.val() };
        }
        
        // NEW FEATURE: Fetch app feature controls
        db.ref('app_feature_controls').on('value', snap => {
            const controls = snap.val();
            if (controls) {
                appFeatureControls = { ...appFeatureControls, ...controls };
            } else {
                // Reset to default if no controls in DB
                appFeatureControls = { add_money: { locked: false, reason: '' }, withdraw_money: { locked: false, reason: '' }, add_game: { locked: false, reason: '' } };
            }
            updateFeatureButtonStates(); // Update button states after controls are loaded/updated
        }, (error) => {
            console.error("Error fetching app feature controls:", error);
            showToast("Failed to load feature controls.", true);
        });

    } catch (error) {
        console.error("Error fetching global settings:", error);
        showToast("Failed to load app settings. Some features may not work correctly.", true);
    }


    if (user) {
        try {
            const userSnap = await db.ref('users/' + user.uid).once('value');
            const fetchedUserData = userSnap.val();

            if (fetchedUserData) {
                if (!fetchedUserData.wallet) {
                    fetchedUserData.wallet = { PKR: fetchedUserData.wallet_balance || 0, INR: 0, USD: 0 };
                    delete fetchedUserData.wallet_balance;
                }
                if (!fetchedUserData.preferred_currency) {
                    fetchedUserData.preferred_currency = 'PKR';
                }
                currentUserData = { uid: user.uid, ...fetchedUserData };
            } else {
                // New user initialization
                currentUserData = {
                    uid: user.uid, email: user.email, username: user.email.split('@')[0],
                    wallet: { PKR: signupBonusAmount, INR: 0, USD: 0 }, preferred_currency: 'PKR',
                    referrals_earned_count: 0, referral_code: user.email.split('@')[0].toLowerCase(), locked: false, lockReason: null
                };
            }

            // Real-time listener for user data
            db.ref('users/' + user.uid).on('value', snap => {
                const updatedData = snap.val();
                if (updatedData) {
                    if (!updatedData.wallet) updatedData.wallet = { PKR: updatedData.wallet_balance || 0, INR: 0, USD: 0 };
                    if (!updatedData.preferred_currency) updatedData.preferred_currency = 'PKR';
                    currentUserData = { uid: user.uid, ...updatedData };

                    document.getElementById('header-wallet-balance').textContent = getFormattedBalance();
                    if (document.getElementById('profilePage').classList.contains('active')) updateProfileContent();
                    if (document.getElementById('walletPage').classList.contains('active')) renderWalletPage(document.getElementById('walletPage'));

                    if (currentUserData.locked) {
                        auth.signOut();
                        showToast(`Account locked: ${currentUserData.lockReason || 'Contact support'}.`, true);
                    }
                }
            });

            // Real-time listener for unread notifications
            db.ref(`notifications/${user.uid}`).orderByChild('status').equalTo('unread').on('value', snapshot => {
                unreadNotificationsCount = snapshot.numChildren();
                const badge = document.getElementById('unread-notifications-count');
                if (badge) {
                    badge.textContent = unreadNotificationsCount;
                    badge.style.display = unreadNotificationsCount > 0 ? 'block' : 'none';
                }
                if (document.getElementById('notificationsPage').classList.contains('active')) renderNotificationsPage(document.getElementById('notificationsPage'));
            });

            // Real-time listener for user's submitted games to check for play limit reached
            if (userSubmittedGamesListener) { // Detach previous listener if exists before attaching a new one
                db.ref('games').off('value', userSubmittedGamesListener);
            }
            userSubmittedGamesListener = db.ref('games').orderByChild('created_by').equalTo(user.uid).on('value', snapshot => {
                const submittedGames = snapshot.val();
                if (submittedGames) {
                    for (const gameId in submittedGames) {
                        const game = submittedGames[gameId];
                        // Check if game status changed to 'completed' (due to play limit) and user hasn't been notified yet
                        if (game.status === 'completed' && !game.notified_play_limit_reached) {
                            db.ref(`notifications/${user.uid}`).push({
                                title: `Game Play Limit Reached! 🥳`,
                                message: `Your game "${game.title}" reached its play limit of ${game.play_limit} and is now hidden from the homepage. You can re-add it from your profile.`,
                                timestamp: new Date().toISOString(),
                                status: 'unread',
                                type: 'game_limit_reached'
                            }).then(() => {
                                db.ref(`games/${gameId}`).update({ notified_play_limit_reached: true }); // Mark as notified
                                // Optionally, re-render profile page if open to update game status
                                if (document.getElementById('profilePage').classList.contains('active')) {
                                    renderProfilePage(document.getElementById('profilePage'));
                                }
                            }).catch(error => {
                                console.error("Error sending game_limit_reached notification:", error);
                                showToast("Failed to send play limit notification.", true);
                            });
                        }
                    }
                }
            });


            // Game played reward for non-tournament games
            if (localStorage.getItem('game_played_pending') === 'true') {
                localStorage.removeItem('game_played_pending');
                db.ref(`users/${user.uid}/wallet/PKR`).transaction(balance => (balance || 0) + 1).then(() => {
                    db.ref(`transactions/${user.uid}`).push({ amount: 1, type: 'credit', currency: 'PKR', description: 'Game Play Reward', created_at: new Date().toISOString() });
                    showToast('🎉 You earned PKR 1 for playing!');
                });
            }

            // Tournament game duration logic
            const activeTid = localStorage.getItem('active_tournament_id');
            if (activeTid) {
                const startTime = parseInt(localStorage.getItem('game_start_time'));
                if (startTime) {
                    const duration = Math.floor((Date.now() - startTime) / 1000);
                    localStorage.removeItem('active_tournament_id');
                    localStorage.removeItem('game_start_time');

                    db.ref(`participants/${activeTid}/${user.uid}`).update({
                        score: duration,
                        gameResult: `Survived: ${duration}s`
                    });
                    showToast(`Played for ${duration} seconds! Score updated.`);
                }
            }

            // Handle pending action after login (e.g., join tournament, play game, open banner link, open YouTube banner video, open drama video player)
            if (pendingAction) {
                const { type, args } = pendingAction;
                pendingAction = null;
                toggleModal('authModal', false);
                if (type === 'playGameUrl') playGameUrl(...args);
                else if (type === 'joinTournament') joinTournament({ preventDefault: () => {} }, ...args);
                else if (type === 'openBannerLink') openBannerLink(...args);
                else if (type === 'openYouTubeBannerVideo') playYouTubeBannerVideo(...args);
                else if (type === 'openDramaVideoPlayer') openDramaVideoPlayer(...args); // NEW: Handle pending drama video player
            }

            // Updated to handle 'game_limit_reached' notifications
            checkAndDisplayGameNotifications(user.uid);
            
            // Navigate to the current active page or homePage
            navigateTo(document.querySelector('.page.active')?.id || 'homePage');

        } catch (error) {
            console.error("Error in onAuthStateChanged for user:", error);
            showToast("Failed to load user data. Please try again.", true);
            auth.signOut(); // Force logout on critical errors during user data load
        }

    } else { // User is logged out
        currentUserData = null;
        document.getElementById('header-wallet-balance').textContent = `...`;
        document.getElementById('unread-notifications-count').style.display = 'none';
        unreadNotificationsCount = 0;
        // Detach listener for user-submitted games on logout
        if (userSubmittedGamesListener) {
            db.ref('games').off('value', userSubmittedGamesListener);
            userSubmittedGamesListener = null;
        }
        navigateTo('homePage');
    }
});

/**
 * Checks for and displays any unread game-related notifications (deletion, limit reached) as a persistent modal popup.
 * Marks the displayed notification as read.
 * @param {string} userId - The current user's UID.
 */
async function checkAndDisplayGameNotifications(userId) {
    if (!userId) return;

    const notificationsRef = db.ref(`notifications/${userId}`);
    try {
        const snapshot = await notificationsRef.orderByChild('status').equalTo('unread').once('value');
        const notifications = snapshot.val();

        if (notifications) {
            for (const notificationId in notifications) {
                const notification = notifications[notificationId];
                if (notification.type === 'game_deletion' || notification.type === 'game_limit_reached') {
                    const modalTitleEl = document.getElementById('deletion-notification-title');
                    const modalMessageEl = document.getElementById('deletion-notification-message');

                    if (modalTitleEl && modalMessageEl) { // Defensive check
                        if (notification.type === 'game_deletion') {
                            modalTitleEl.textContent = notification.message.split('. Reason:')[0] || 'Your game has been deleted.';
                            modalMessageEl.innerHTML = notification.message.includes('. Reason:') 
                                ? `<strong>Reason:</strong> ${notification.message.split('. Reason:')[1]}`
                                : 'No specific reason was provided by the admin.';
                        } else if (notification.type === 'game_limit_reached') {
                            modalTitleEl.textContent = 'Game Play Limit Reached!';
                            modalMessageEl.innerHTML = `🥳 ${notification.message}<br><br>You can re-add the game with a new play limit from your profile to make it live again.`;
                        }
                        
                        toggleModal('gameDeletionNotificationModal', true);
                        
                        // Mark as read in Firebase
                        await notificationsRef.child(notificationId).update({ status: 'read', read_at: new Date().toISOString() });
                        
                        break; // Only show one notification at a time, then break
                    } else {
                        console.warn("Deletion notification modal elements not found.");
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error checking/displaying game notifications:", error);
        showToast("Failed to load game notifications.", true);
    }
}


/**
 * Loads content into the main content area based on the pageId.
 * @param {string} pageId - The ID of the page to load content for.
 * @param {object} [data=null] - Optional data to pass to the rendering function.
 */
function loadPageContent(pageId, data = null) {
    const container = document.getElementById(pageId);
    if (!container) return;
    switch (pageId) {
        case 'homePage': renderHomePage(container); break;
        case 'myTournamentsPage': renderMyTournamentsPage(container); break;
        case 'walletPage': renderWalletPage(container); break;
        case 'profilePage': renderProfilePage(container); break;
        case 'notificationsPage': renderNotificationsPage(container); break;
        case 'videoPlayerPage': renderVideoPlayerPage(container, data); break;
    }
}

/**
 * Helper function to safely escape strings for JavaScript in HTML attribute context.
 * Prevents issues with quotes or special characters breaking JS parsing.
 * @param {string} s - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeJsStringForHtmlAttribute(s) {
    const str = String(s || '');
    return str.replace(/\\/g, '\\\\')
              .replace(/'/g, '\\\'')
              .replace(/"/g, '&quot;')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r');
}

/**
 * Renders the game categories and games on the home page.
 */
function renderGameCategories() {
    const gamesByCategoryList = document.getElementById('games-by-category-list');
    const loadMoreCategoriesBtn = document.getElementById('loadMoreCategoriesBtn');
    if (!gamesByCategoryList || !loadMoreCategoriesBtn) return;

    let categoriesHtml = '';
    const allCategoriesSorted = Object.keys(gamesByCategory).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    if (displayedCategories.length === 0 || !allCategoriesSorted.slice(0, displayedCategories.length).every((cat, i) => cat === displayedCategories[i])) {
        displayedCategories = allCategoriesSorted.slice(0, CATEGORY_CHUNK_SIZE);
        gamesDisplayedPerCategory = {};
    }

    displayedCategories.forEach(category => {
        categoriesHtml += `<h3 class="col-span-2 text-xl font-bold mt-6 mb-3 text-gray-700">${escapeJsStringForHtmlAttribute(category)}</h3>`;
        categoriesHtml += `<div id="category-games-${category.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}" class="grid grid-cols-2 gap-4 mb-4">`;

        const gamesInThisCategory = gamesByCategory[category];
        const currentDisplayedCount = gamesDisplayedPerCategory[category] || GAME_CHUNK_SIZE;
        const gamesToDisplay = gamesInThisCategory.slice(0, currentDisplayedCount);

        gamesToDisplay.forEach(game => {
            categoriesHtml += `
                <div class="bg-white rounded-xl shadow-lg overflow-hidden border border-orange-100 transform transition duration-300 hover:scale-105">
                    <div class="h-32 bg-gray-200 relative">
                        <img src="${escapeJsStringForHtmlAttribute(game.image_url || 'https://via.placeholder.com/300x200?text=Game')}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x200?text=Game'">
                        <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 to-transparent p-2">
                            <h3 class="text-white font-bold text-sm shadow-black drop-shadow-md">${escapeJsStringForHtmlAttribute(game.title)}</h3>
                        </div>
                    </div>
                    <div class="p-3">
                        <button onclick="checkLoginAndAct(event, 'playGameUrl', '${escapeJsStringForHtmlAttribute(game.id)}', '${escapeJsStringForHtmlAttribute(game.game_url)}')" class="w-full text-white bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 py-2 rounded-lg font-bold text-sm shadow-md">
                            <i class="fas fa-play mr-1"></i> OPEN NOW
                        </button>
                    </div>
                </div>
            `;
        });
        categoriesHtml += `</div>`;

        if (gamesInThisCategory.length > currentDisplayedCount) {
            categoriesHtml += `
                <div class="text-center mb-4">
                    <button onclick="loadMoreGamesInCategory('${escapeJsStringForHtmlAttribute(category)}')" class="bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-orange-600 transition-colors">More Games</button>
                </div>`;
        }
    });
    gamesByCategoryList.innerHTML = categoriesHtml;

    if (allCategoriesSorted.length > displayedCategories.length) {
        loadMoreCategoriesBtn.classList.remove('hidden');
    } else {
        loadMoreCategoriesBtn.classList.add('hidden');
    }

    if (allApprovedGames.length === 0) {
        gamesByCategoryList.innerHTML = `<div class="col-span-2 text-center text-gray-500">No games available yet.</div>`;
    }
}

/**
 * Loads more categories onto the home page.
 */
function loadMoreCategories() {
    const allCategoriesSorted = Object.keys(gamesByCategory).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });
    const currentCount = displayedCategories.length;
    const nextBatch = allCategoriesSorted.slice(currentCount, currentCount + CATEGORY_CHUNK_SIZE);
    if (nextBatch.length > 0) {
        displayedCategories = [...displayedCategories, ...nextBatch];
        renderGameCategories();
    }
}

/**
 * Loads more games within a specific category.
 * @param {string} category - The category to load more games for.
 */
function loadMoreGamesInCategory(category) {
    const gamesInThisCategory = gamesByCategory[category];
    const currentDisplayedCount = gamesDisplayedPerCategory[category] || GAME_CHUNK_SIZE;
    const newCount = currentDisplayedCount + GAME_CHUNK_SIZE;
    gamesDisplayedPerCategory[category] = Math.min(newCount, gamesInThisCategory.length);
    renderGameCategories();
}

/**
 * Performs a search for games based on the search term.
 * @param {string} searchTerm - The term to search for.
 */
function performSearch(searchTerm) {
    searchResults = allApprovedGames.filter(game =>
        game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        game.category.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.title.localeCompare(b.title));
    
    searchGamesDisplayed = 0;
    displaySearchResults();
    
    document.getElementById('searchResultsContainer').classList.remove('hidden');
    document.getElementById('gameCategoriesContainer').classList.add('hidden');
}

/**
 * Displays search results, with an option to load more.
 * @param {boolean} loadMore - Whether to append more results or clear and display fresh results.
 */
function displaySearchResults(loadMore = false) {
    const searchResultsList = document.getElementById('searchResultsList');
    const loadMoreSearchResultsBtn = document.getElementById('loadMoreSearchResults');
    const noSearchResults = document.getElementById('noSearchResults');

    if (!loadMore) {
        searchResultsList.innerHTML = '';
    }

    if (searchResults.length === 0) {
        noSearchResults.classList.remove('hidden');
        loadMoreSearchResultsBtn.classList.add('hidden');
        searchResultsList.innerHTML = '';
        return;
    } else {
        noSearchResults.classList.add('hidden');
    }

    const startIndex = searchGamesDisplayed;
    const endIndex = Math.min(searchResults.length, startIndex + SEARCH_RESULT_CHUNK_SIZE);
    const gamesToAdd = searchResults.slice(startIndex, endIndex);

    let searchHtml = '';
    gamesToAdd.forEach(game => {
        searchHtml += `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden border border-orange-100 transform transition duration-300 hover:scale-105">
                <div class="h-32 bg-gray-200 relative">
                    <img src="${escapeJsStringForHtmlAttribute(game.image_url || 'https://via.placeholder.com/300x200?text=Game')}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x200?text=Game'">
                    <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 to-transparent p-2">
                        <h3 class="text-white font-bold text-sm shadow-black drop-shadow-md">${escapeJsStringForHtmlAttribute(game.title)}</h3>
                        </div>
                    </div>
                    <div class="p-3">
                        <button onclick="checkLoginAndAct(event, 'playGameUrl', '${escapeJsStringForHtmlAttribute(game.id)}', '${escapeJsStringForHtmlAttribute(game.game_url)}')" class="w-full text-white bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 py-2 rounded-lg font-bold text-sm shadow-md">
                            <i class="fas fa-play mr-1"></i> OPEN NOW
                        </button>
                    </div>
                </div>
            `;
        });
        searchResultsList.insertAdjacentHTML('beforeend', searchHtml);
        searchGamesDisplayed = endIndex;

        if (searchGamesDisplayed < searchResults.length) {
            loadMoreSearchResultsBtn.classList.remove('hidden');
        } else {
            loadMoreSearchResultsBtn.classList.add('hidden');
        }
    }


    /**
     * Renders the Home Page content dynamically.
     * @param {HTMLElement} container - The container element for the home page.
     */
    async function renderHomePage(container) {
        // Reset global state for home page content display
        allApprovedGames = [];
        gamesByCategory = {};
        displayedCategories = [];
        gamesDisplayedPerCategory = {};
        searchResults = [];
        searchGamesDisplayed = 0;
        allGeneralBanners = []; // Reset general banners
        allYouTubeBanners = []; // Reset YouTube banners
        allDramas = []; // NEW: Reset dramas

        const searchInput = document.getElementById('gameSearchInput');
        const searchResultsContainer = document.getElementById('searchResultsContainer');
        const loadMoreSearchResultsBtn = document.getElementById('loadMoreSearchResults');
        const gameCategoriesContainer = document.getElementById('gameCategoriesContainer');
        const loadMoreCategoriesBtn = document.getElementById('loadMoreCategoriesBtn');
        const generalBannerSwiperWrapper = document.getElementById('banner-swiper-wrapper');
        const youtubeBannerSwiperWrapper = document.getElementById('youtube-banner-swiper-wrapper');
        const dramaSwiperWrapper = document.getElementById('drama-swiper-wrapper'); // NEW
        
        // Clear previous content if any
        if (generalBannerSwiperWrapper) generalBannerSwiperWrapper.innerHTML = `<div class="swiper-slide flex items-center justify-center bg-gray-700 text-white text-center">Loading Banners...</div>`;
        if (youtubeBannerSwiperWrapper) youtubeBannerSwiperWrapper.innerHTML = `<div class="swiper-slide flex items-center justify-center bg-gray-700 text-white text-center">Loading YouTube Banners...</div>`;
        if (dramaSwiperWrapper) dramaSwiperWrapper.innerHTML = `<div class="swiper-slide flex items-center justify-center bg-gray-700 text-white text-center h-64 rounded-xl border border-dashed border-red-500">Loading Dramas...</div>`; // NEW
        if (document.getElementById('games-by-category-list')) document.getElementById('games-by-category-list').innerHTML = `<div class="col-span-2 text-center py-10"><i class="fas fa-spinner fa-spin fa-2x text-red-500"></i><p class="mt-2 text-gray-400">Loading games...</p></div>`;
        if (document.getElementById('live-event-content')) document.getElementById('live-event-content').innerHTML = `<p class="text-center text-gray-500 italic">Loading live event info...</p>`;
        if (document.getElementById('video-sections-list-home')) document.getElementById('video-sections-list-home').innerHTML = `<p class="text-center text-gray-500 italic">Loading video sections...</p>`;
        if (document.getElementById('tournament-list')) document.getElementById('tournament-list').innerHTML = `<div class="text-center py-10"><i class="fas fa-spinner fa-spin fa-2x text-red-500"></i></div>`;


        // 1. Load General Banners
        db.ref('banners').on('value', snapshot => {
            allGeneralBanners = [];
            const bannersData = snapshot.val();
            if (bannersData) {
                Object.entries(bannersData).forEach(([id, banner]) => {
                    if (banner.status === 'active') { // Only show active banners
                        allGeneralBanners.push({ id, ...banner });
                    }
                });
                allGeneralBanners.sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort by an 'order' field if available
            }

            if (generalBannerSwiperWrapper) {
                if (allGeneralBanners.length > 0) {
                    generalBannerSwiperWrapper.innerHTML = allGeneralBanners.map(banner => `
                        <div class="swiper-slide">
                            <a href="#" onclick="checkLoginAndAct(event, 'openBannerLink', '${escapeJsStringForHtmlAttribute(banner.link_url)}')">
                                <img src="${escapeJsStringForHtmlAttribute(banner.image_url || 'https://via.placeholder.com/400x180?text=Banner')}" 
                                     alt="${escapeJsStringForHtmlAttribute(banner.title || 'Banner Image')}" 
                                     class="w-full h-full object-cover rounded-xl">
                            </a>
                        </div>
                    `).join('');
                } else {
                    generalBannerSwiperWrapper.innerHTML = `<div class="swiper-slide flex items-center justify-center bg-gray-700 text-white text-center">No banners available.</div>`;
                }

                // Initialize Swiper for general banners
                if (generalBannerSwiperInstance) {
                    generalBannerSwiperInstance.destroy(true, true); // Destroy existing instance
                }
                generalBannerSwiperInstance = new Swiper(".bannerSwiper", {
                    loop: true,
                    autoplay: {
                        delay: bannerAutoplayDelay, // Use dynamic delay from app_settings
                        disableOnInteraction: false,
                    },
                    pagination: {
                        el: ".swiper-pagination",
                        clickable: true,
                    },
                });
            }
        });

        // 2. NEW: Load Dramas
        db.ref('dramas').on('value', snapshot => {
            allDramas = [];
            const dramasData = snapshot.val();
            if (dramasData) {
                Object.entries(dramasData).forEach(([id, drama]) => {
                    if (drama.status === 'active') { // Only show active dramas
                        allDramas.push({ id, ...drama });
                    }
                });
                allDramas.sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort by an 'order' field if available
            }
            console.log("Fetched Dramas:", allDramas); // Debugging line

            if (dramaSwiperWrapper) {
                if (allDramas.length > 0) {
                    dramaSwiperWrapper.innerHTML = allDramas.map(drama => `
                        <div class="swiper-slide">
                            <div onclick="checkLoginAndAct(event, 'openDramaVideoPlayer', '${escapeJsStringForHtmlAttribute(drama.id)}')" 
                                 class="drama-card relative w-full h-full rounded-xl overflow-hidden shadow-lg cursor-pointer transform transition duration-300 hover:scale-105"
                                 style="background-image: url('${escapeJsStringForHtmlAttribute(drama.poster_image_url || 'https://via.placeholder.com/300x450?text=Drama+Poster+Missing')}') !important; background-size: cover; background-position: center; min-height: 250px;"
                                 onerror="this.style.backgroundImage='url(https://via.placeholder.com/300x450?text=No+Poster)'">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                                <div class="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center">
                                    <i class="fas fa-eye mr-1"></i> ${formatViewsCount(drama.views_count || 0)}
                                </div>
                                <div class="absolute bottom-0 left-0 right-0 p-3 text-white">
                                    <h3 class="font-black text-lg leading-tight">${escapeJsStringForHtmlAttribute(drama.title)}</h3>
                                    <div class="flex flex-wrap gap-1 mt-1">
                                        ${(drama.tags || []).map(tag => `<span class="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">${escapeJsStringForHtmlAttribute(tag)}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('');
                    console.log("Drama HTML generated and inserted."); // Debugging line
                } else {
                    dramaSwiperWrapper.innerHTML = `<div class="swiper-slide flex items-center justify-center bg-gray-700 text-white text-center h-64 rounded-xl border border-dashed border-red-500">No dramas available.</div>`;
                    console.log("No dramas found, displaying placeholder."); // Debugging line
                }

                // Initialize Swiper for Dramas (manual swipe, 2 columns)
                if (dramaSwiperInstance) {
                    dramaSwiperInstance.destroy(true, true); // Destroy existing instance
                    console.log("Existing dramaSwiperInstance destroyed."); // Debugging line
                }
                dramaSwiperInstance = new Swiper(".dramaSwiper", {
                    slidesPerView: 2,
                    spaceBetween: 16, // Corresponds to Tailwind's gap-4
                    loop: true,
                    autoplay: false, // Manual swipe only
                    pagination: {
                        el: ".swiper-pagination",
                        clickable: true,
                    },
                });
                console.log("dramaSwiperInstance re-initialized."); // Debugging line
            } else {
                console.warn("dramaSwiperWrapper not found."); // Debugging line
            }
        });

        // 3. Load YouTube Banners
        db.ref('youtube_banners').on('value', snapshot => {
            allYouTubeBanners = [];
            const youtubeBannersData = snapshot.val();
            if (youtubeBannersData) {
                Object.entries(youtubeBannersData).forEach(([id, banner]) => {
                    if (banner.status === 'active') { // Only show active banners
                        allYouTubeBanners.push({ id, ...banner });
                    }
                });
                allYouTubeBanners.sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort by an 'order' field if available
            }

            if (youtubeBannerSwiperWrapper) {
                if (allYouTubeBanners.length > 0) {
                    youtubeBannerSwiperWrapper.innerHTML = allYouTubeBanners.map(banner => {
                        const youtubeThumbnail = `https://img.youtube.com/vi/${getYoutubeVideoId(banner.youtube_url)}/hqdefault.jpg`;
                        return `
                            <div class="swiper-slide relative flex items-center justify-center bg-black rounded-xl overflow-hidden">
                                <div id="youtube-player-${escapeJsStringForHtmlAttribute(banner.id)}" class="w-full h-full flex items-center justify-center">
                                    <img src="${escapeJsStringForHtmlAttribute(youtubeThumbnail)}" 
                                         alt="${escapeJsStringForHtmlAttribute(banner.title || 'YouTube Video Thumbnail')}" 
                                         class="w-full h-full object-cover opacity-70">
                                    <button onclick="checkLoginAndAct(event, 'openYouTubeBannerVideo', '${escapeJsStringForHtmlAttribute(banner.id)}', '${escapeJsStringForHtmlAttribute(banner.youtube_url)}')" 
                                            class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-lg font-bold p-4 rounded-xl hover:bg-black/70 transition-all">
                                        <i class="fab fa-youtube fa-3x text-red-500 mb-2"></i>
                                        <span>OPEN NOW</span>
                                        <span class="text-sm font-normal mt-1">${escapeJsStringForHtmlAttribute(banner.title || 'Watch Video')}</span>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    youtubeBannerSwiperWrapper.innerHTML = `<div class="swiper-slide flex items-center justify-center bg-gray-700 text-white text-center">No YouTube banners available.</div>`;
                }

                // Initialize Swiper for YouTube banners (no autoplay)
                if (youtubeBannerSwiperInstance) {
                    youtubeBannerSwiperInstance.destroy(true, true); // Destroy existing instance
                }
                youtubeBannerSwiperInstance = new Swiper(".youtubeBannerSwiper", {
                    loop: true, // Keep loop for continuous manual swiping
                    autoplay: false, // No autoplay
                    pagination: {
                        el: ".swiper-pagination",
                        clickable: true,
                    },
                    navigation: { // Optional: Add navigation arrows if desired
                        nextEl: ".swiper-button-next",
                        prevEl: ".swiper-button-prev",
                    },
                });
            }
        });


        // 4. Listener for games data (real-time updates) - ONLY FETCHES 'approved' GAMES
        db.ref('games').orderByChild('status').equalTo('approved').on('value', snapshot => {
            const gamesData = snapshot.val();
            allApprovedGames = [];
            gamesByCategory = {};

            if (gamesData) {
                Object.entries(gamesData).forEach(([id, game]) => {
                    allApprovedGames.push({ id, ...game });
                    const category = (game.category && String(game.category).trim()) ? String(game.category).trim() : 'Uncategorized';
                    if (!gamesByCategory[category]) {
                        gamesByCategory[category] = [];
                    }
                    gamesByCategory[category].push({ id, ...game });
                });
                for (const category in gamesByCategory) {
                    gamesByCategory[category].sort((a, b) => a.title.localeCompare(b.title));
                }
            }
            
            const currentSearchTerm = searchInput.value.trim();
            if (currentSearchTerm) {
                performSearch(currentSearchTerm);
            } else {
                renderGameCategories();
            }
        });

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.trim();
            if (searchTerm.length > 0) {
                performSearch(searchTerm);
            } else {
                searchResultsContainer.classList.add('hidden');
                gameCategoriesContainer.classList.remove('hidden');
                renderGameCategories();
            }
        });

        loadMoreSearchResultsBtn.addEventListener('click', () => displaySearchResults(true));
        loadMoreCategoriesBtn.addEventListener('click', () => loadMoreCategories());

        // 5. Load Video Content Sections
        const videoSectionsListHomeEl = document.getElementById('video-sections-list-home');
        try {
            db.ref('video_sections').on('value', snap => {
                const sections = snap.val();
                if (!sections) {
                    videoSectionsListHomeEl.innerHTML = `<p class="text-center text-gray-500 italic py-4">No video content sections available yet.</p>`;
                    return;
                }
                let sectionsHtml = '';
                const sectionsArray = Object.entries(sections).map(([id, section]) => ({id, ...section}));
                sectionsArray.sort((a, b) => a.title.localeCompare(b.title));

                sectionsArray.forEach(section => {
                    const safeSection = {
                        id: escapeJsStringForHtmlAttribute(section.id),
                        title: escapeJsStringForHtmlAttribute(section.title),
                        description: escapeJsStringForHtmlAttribute(section.description),
                        youtubeUrl: escapeJsStringForHtmlAttribute(section.youtubeUrl),
                        watchTimeSeconds: section.watchTimeSeconds,
                        rewardPkr: section.rewardPkr
                    };
                    sectionsHtml += `
                        <div onclick='navigateTo("videoPlayerPage", ${JSON.stringify(safeSection)})' class="bg-white p-3 rounded-xl shadow-sm border border-green-100 flex items-center justify-between cursor-pointer hover:bg-green-50 transition-colors">
                            <div>
                                <h4 class="font-bold text-gray-800">${safeSection.title}</h4>
                                <p class="text-sm text-gray-600">${safeSection.description || 'No description'}</p>
                            </div>
                            <i class="fas fa-chevron-right text-gray-400"></i>
                        </div>
                    `;
                });
                videoSectionsListHomeEl.innerHTML = sectionsHtml;
            });
        } catch (error) {
            console.error("Error loading video sections:", error);
            videoSectionsListHomeEl.innerHTML = `<p class="text-center text-red-500 italic py-4">Error loading video content.</p>`;
        }

        // 6. Load Live Event/Game Info
        const liveEventContentEl = document.getElementById('live-event-content');
        try {
            db.ref('live_game').on('value', snap => {
                const liveGameData = snap.val();
                if (liveGameData && liveGameData.status !== 'inactive' && (liveGameData.title || liveGameData.url)) {
                    let statusText = '';
                    let actionButton = '';
                    if (liveGameData.status === 'live') {
                        statusText = '<span class="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold animate-pulse">LIVE NOW</span>';
                        actionButton = `<a href="${escapeJsStringForHtmlAttribute(liveGameData.url)}" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-600 transition">Watch Live <i class="fas fa-play-circle ml-1"></i></a>`;
                    } else if (liveGameData.status === 'upcoming') {
                        statusText = '<span class="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-semibold">UPCOMING</span>';
                        if (liveGameData.url) {
                            actionButton = `<a href="${escapeJsStringForHtmlAttribute(liveGameData.url)}" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 transition">View Details <i class="fas fa-info-circle ml-1"></i></a>`;
                        }
                    }
                    liveEventContentEl.innerHTML = `
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="font-bold text-lg text-gray-800">${escapeJsStringForHtmlAttribute(liveGameData.title || 'Live Event')}</h3>
                            ${statusText}
                        </div>
                        <p class="text-sm text-gray-600">${escapeJsStringForHtmlAttribute(liveGameData.description || 'No description available.')}</p>
                        ${actionButton}
                    `;
                } else {
                    liveEventContentEl.innerHTML = `<p class="text-center text-gray-500 italic py-4">No live or upcoming event information available.</p>`;
                }
            });
        } catch (error) {
            console.error("Error loading live game info:", error);
            liveEventContentEl.innerHTML = `<p class="text-center text-red-500 italic py-4">Error loading live event info.</p>`;
        }


        // 7. Load Tournaments
        const listEl = document.getElementById('tournament-list');
        listEl.innerHTML = `<div class="text-center py-10"><i class="fas fa-spinner fa-spin fa-2x text-red-500"></i></div>`;

        try {
            const tournaments = (await db.ref('tournaments').orderByChild('status').equalTo('Upcoming').once('value')).val();
            if (!tournaments) {
                listEl.innerHTML = `<div class="text-center text-gray-400 py-8"><p>No upcoming tournaments.</p></div>`;
            } else {
                listEl.innerHTML = Object.entries(tournaments).map(([id, t]) => {
                    const isUserLoggedIn = auth.currentUser;
                    const buttonText = isUserLoggedIn ? 'Join Match' : 'Login to Join';
                    const buttonAction = isUserLoggedIn ? `joinTournament(event, '${escapeJsStringForHtmlAttribute(id)}', ${t.entry_fee})` : `checkLoginAndAct(event, 'joinTournament', '${escapeJsStringForHtmlAttribute(id)}', ${t.entry_fee})`;

                    return `
                                <div class="bg-gradient-to-br from-red-50 to-yellow-50 rounded-xl shadow-md border border-red-100 overflow-hidden">
                                    <div class="p-4 flex justify-between items-start border-b border-red-100/50">
                                        <div><h3 class="font-bold text-lg text-red-900">${t.title}</h3><span class="text-xs font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 px-3 py-1 rounded-full shadow-sm">${formatCurrency(t.prize_pool, 'PKR')} Pool</span>
                                    </div>
                                    <div class="p-4 grid grid-cols-2 gap-4 text-sm">
                                        <div class="bg-white/60 p-2 rounded border border-red-100"><p class="text-gray-500 text-xs">Entry Fee</p><p class="font-bold text-gray-800">${formatCurrency(t.entry_fee, 'PKR')}</p></div>
                                        <div class="bg-white/60 p-2 rounded border border-red-100"><p class="text-gray-500 text-xs">Time</p><p class="font-bold text-gray-800">${new Date(t.match_time).toLocaleDateString()}</p></div>
                                    </div>
                                    <div class="p-3">
                                        <button onclick="${buttonAction}" class="w-full text-white bg-gradient-to-r from-red-600 to-orange-500 font-bold py-2 rounded-lg shadow-lg hover:shadow-lg transition">${buttonText}</button>
                                    </div>
                                </div>`;
                }).join('');
            }
        } catch (error) {
            console.error("Error loading tournaments:", error);
            listEl.innerHTML = `<p class="text-center text-red-500 italic py-8">Error loading tournaments.</p>`;
        }
    }

    /**
     * Helper function to extract YouTube video ID from various YouTube URLs.
     * @param {string} url - The YouTube URL.
     * @returns {string|null} The video ID or null if not found.
     */
    function getYoutubeVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    /**
     * NEW: Plays a YouTube video directly within its banner slide.
     * @param {string} bannerId - The ID of the banner element.
     * @param {string} youtubeUrl - The YouTube video URL.
     */
    function playYouTubeBannerVideo(bannerId, youtubeUrl) {
        const playerContainer = document.getElementById(`youtube-player-${bannerId}`);
        if (!playerContainer) {
            showToast("Video player container not found!", true);
            return;
        }

        const videoId = getYoutubeVideoId(youtubeUrl);
        if (!videoId) {
            showToast("Invalid YouTube URL!", true);
            return;
        }

        const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        playerContainer.innerHTML = `
            <iframe src="${embedUrl}" 
                    class="w-full h-full border-0 rounded-xl" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
            </iframe>
        `;
    }

    /**
     * NEW: Opens the video player page for a drama.
     * @param {string} dramaId - The ID of the drama.
     */
    async function openDramaVideoPlayer(dramaId) {
        // Fetch the full drama data using its ID
        try {
            const dramaSnap = await db.ref(`dramas/${dramaId}`).once('value');
            const drama = dramaSnap.val();

            if (!drama) {
                showToast('Drama not found!', true);
                return;
            }

            // This will navigate to the existing videoPlayerPage, but with drama-specific data
            // The videoPlayerPage is designed to handle a 'youtubeUrl' property, so we map it.
            navigateTo('videoPlayerPage', {
                id: dramaId,
                title: drama.title,
                youtubeUrl: drama.video_url, // Use video_url property for compatibility
                description: drama.description || `Watch ${drama.title} now!`, // Use drama description if available, else generic
                watchTimeSeconds: drama.watchTimeSeconds || 0, // Dramas now have watch time rewards
                rewardPkr: drama.rewardPkr || 0
            });

            // Optionally increment views count for the drama
            db.ref(`dramas/${dramaId}/views_count`).transaction(currentViews => {
                return (currentViews || 0) + 1;
            });

        } catch (error) {
            console.error("Error opening drama video player:", error);
            showToast("Failed to open drama video. Please try again.", true);
        }
    }


    /**
     * Helper function to convert a standard YouTube URL to an embeddable URL.
     * Also handles Google Drive and direct video links.
     * @param {string} url - The original video URL.
     * @returns {string} The embeddable URL or direct video URL.
     */
    function convertVideoUrlToEmbed(url) {
        if (!url) return '';

        // YouTube URL
        let videoId = getYoutubeVideoId(url);
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        }

        // Google Drive embed URL (common pattern, might need adjustment based on specific link)
        if (url.includes('drive.google.com')) {
            // Updated to handle both "view" and "preview" links
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                return `https://drive.google.com/file/d/${match[1]}/preview`;
            }
        }

        // Direct video link (MP4, WebM, etc.)
        // For direct links, the browser can often play them directly in an iframe or video tag.
        // We'll return the original URL, and renderVideoPlayerPage will decide if it's an iframe or video tag.
        return url;
    }

    /**
     * Renders the Video Player Page dynamically.
     * @param {HTMLElement} container - The container element.
     * @param {object} data - The video section data. Expected to have `youtubeUrl` (now generic `video_url`), `title`, `description`, `watchTimeSeconds`, `rewardPkr`.
     */
    async function renderVideoPlayerPage(container, data) {
        if (!data || !data.youtubeUrl) { // Changed from youtubeUrl to be more generic for video_url
            container.innerHTML = `<div class="p-4 text-center mt-10">Error: No video data found. <button onclick="navigateTo('homePage')" class="text-blue-500 underline mt-2 block">Go Back</button></div>`;
            return;
        }

        const videoSourceUrl = convertVideoUrlToEmbed(data.youtubeUrl); // Use the generic video URL
        const watchTime = parseInt(data.watchTimeSeconds) || 0;
        const reward = parseInt(data.rewardPkr) || 0;

        let videoPlayerHtml = '';
        
        // Always use iframe for YouTube and Google Drive for reliability
        if (videoSourceUrl.includes('youtube.com/embed/') || videoSourceUrl.includes('drive.google.com/file/d/')) {
            videoPlayerHtml = `<iframe src="${videoSourceUrl}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        }
        // Use <video> tag for direct file links
        else if (videoSourceUrl.match(/\.(mp4|webm|ogg)$/i)) { 
            videoPlayerHtml = `
                <video controls autoplay class="w-full h-full bg-black">
                    <source src="${videoSourceUrl}" type="video/mp4">
                    <source src="${videoSourceUrl}" type="video/webm">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            // Fallback for other URLs, assuming they might be embeddable in an iframe
            videoPlayerHtml = `<iframe src="${videoSourceUrl}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        }


        container.innerHTML = `
            <div class="bg-black min-h-screen text-white flex flex-col pb-20">
                <div class="p-4 flex items-center gap-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
                    <button onclick="navigateTo('homePage')" class="text-gray-400 hover:text-white"><i class="fas fa-arrow-left fa-lg"></i></button>
                    <h2 class="text-lg font-bold truncate flex-1">${escapeJsStringForHtmlAttribute(data.title)}</h2>
                </div>
                
                <div class="w-full aspect-video bg-black relative shadow-lg">
                    ${videoPlayerHtml}
                </div>

                <div class="p-5 flex-1 bg-gray-900">
                    <h3 class="text-xl font-bold mb-2 text-white">${escapeJsStringForHtmlAttribute(data.title)}</h3>
                    <p class="text-gray-400 text-sm mb-6">${escapeJsStringForHtmlAttribute(data.description || '')}</p>

                    <div class="bg-gray-800 rounded-xl p-5 border border-gray-700 shadow-inner">
                        <div id="video-reward-status" class="text-center">
                            ${auth.currentUser && watchTime > 0 && reward > 0
                                ? `<p class="font-semibold text-yellow-400 mb-3 text-lg">Watch for <span id="video-timer-display" class="font-black text-2xl text-white mx-1">${watchTime}</span> seconds to earn PKR ${reward}!</p>
                                   <div class="w-full bg-gray-700 rounded-full h-3 mt-2 overflow-hidden shadow-inner">
                                       <div id="video-progress-bar" class="bg-gradient-to-r from-red-500 to-yellow-500 h-3 rounded-full transition-all duration-1000 ease-linear" style="width: 0%"></div>
                                   </div>`
                                : `<p class="text-gray-300 italic mb-3">Login is required to earn rewards for watching.</p>
                                   <button onclick="toggleModal('authModal', true)" class="bg-gradient-to-r from-red-600 to-yellow-500 text-white px-6 py-2 rounded-full font-bold shadow-md hover:shadow-lg transition-transform transform active:scale-95">Login Now</button>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (auth.currentUser && watchTime > 0 && reward > 0) {
            startVideoRewardTimer(watchTime, reward, data.id, data.title, data.title); 
        }
    }

    /**
     * Handles the countdown timer for video rewards.
     * @param {number} totalSeconds - Total time to watch.
     * @param {number} rewardPkr - Reward amount.
     * @param {string} videoId - Database ID of the video section.
     * @param {string} videoTitle - Title of the video.
     * @param {string} sectionTitle - Section title (often same as video title in this structure).
     */
    function startVideoRewardTimer(totalSeconds, rewardPkr, videoId, videoTitle, sectionTitle) {
        let timeLeft = totalSeconds;
        const timerDisplay = document.getElementById('video-timer-display');
        const progressBar = document.getElementById('video-progress-bar');
        const statusContainer = document.getElementById('video-reward-status');

        if (!timerDisplay || !progressBar || !statusContainer) return;

        if (videoRewardTimer) clearInterval(videoRewardTimer);

        videoRewardTimer = setInterval(async () => {
            timeLeft--;
            
            if (timerDisplay) timerDisplay.textContent = timeLeft;
            
            if (progressBar) {
                const percentage = ((totalSeconds - timeLeft) / totalSeconds) * 100;
                progressBar.style.width = `${percentage}%`;
            }

            if (timeLeft <= 0) {
                clearInterval(videoRewardTimer);
                videoRewardTimer = null;
                
                statusContainer.innerHTML = `<p class="font-bold text-green-400 text-lg"><i class="fas fa-spinner fa-spin mr-2"></i>Claiming Reward...</p>`;
                
                await claimVideoReward(rewardPkr, videoId, videoTitle, sectionTitle, statusContainer);
            }
        }, 1000);
    }

    /**
     * Claims the reward after the video timer finishes.
     */
    async function claimVideoReward(rewardPkr, videoId, videoTitle, sectionTitle, statusContainer) {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const logRef = db.ref(`video_watch_logs/${user.uid}/${videoId}`);
            const logSnap = await logRef.once('value');
            
            if (logSnap.exists()) {
                statusContainer.innerHTML = `<p class="font-bold text-gray-400 text-lg"><i class="fas fa-check-circle text-green-500 mr-2"></i>Reward already claimed for this video.</p>`;
                return;
            }

            const walletPKRRef = db.ref(`users/${user.uid}/wallet/PKR`);
            let committed = false;
            
            await walletPKRRef.transaction(currentBalance => {
                const balance = currentBalance !== null && typeof currentBalance === 'number' ? currentBalance : 0;
                return balance + rewardPkr;
            }, async (error, _committed, snapshot) => {
                if (error) {
                    console.error('Video reward transaction failed', error);
                    statusContainer.innerHTML = `<p class="font-bold text-red-500">Failed to claim reward. Please try again later.</p>`;
                } else if (_committed) {
                    committed = true;
                    
                    await db.ref(`transactions/${user.uid}`).push({
                        amount: rewardPkr,
                        type: 'credit',
                        currency: 'PKR',
                        description: `Video Reward: ${videoTitle}`,
                        created_at: new Date().toISOString()
                    });

                    await logRef.set({
                        videoTitle: videoTitle,
                        sectionTitle: sectionTitle,
                        durationSeconds: rewardPkr, 
                        rewardEarned: rewardPkr,
                        timestamp: new Date().toISOString()
                    });

                    statusContainer.innerHTML = `<p class="font-bold text-green-400 text-xl animate-pulse"><i class="fas fa-gift mr-2 text-yellow-400"></i>${formatCurrency(rewardPkr, 'PKR')} added to wallet!</p>`;
                    showToast(`🎉 You earned ${formatCurrency(rewardPkr, 'PKR')} for watching!`);
                    
                    if (currentUserData) {
                        currentUserData.wallet.PKR = snapshot.val();
                        const headerWalletBalanceEl = document.getElementById('header-wallet-balance');
                        if (headerWalletBalanceEl) headerWalletBalanceEl.textContent = getFormattedBalance();
                    }
                } else {
                    statusContainer.innerHTML = `<p class="font-bold text-red-500">Transaction aborted.</p>`;
                }
            });

        } catch (error) {
            console.error("Error claiming video reward:", error);
            statusContainer.innerHTML = `<p class="font-bold text-red-500">An error occurred while claiming.</p>`;
        }
    }


    /**
     * Initiates playing a game URL, optionally as part of a tournament, and handles play count logic for regular games.
     * @param {string} gameId - The ID of the game from the database (relevant for non-tournament games).
     * @param {string} url - The URL of the game.
     * @param {string} [tournamentId=null] - The ID of the tournament, if applicable.
     */
    async function playGameUrl(gameId, url, tournamentId = null) {
        if (!auth.currentUser) {
            return showToast('Login required to play!', true);
        }
        if (!url) return showToast("Game URL missing!", true);
        if (!currentUserData || currentUserData.locked) { 
            auth.signOut();
            const lockReason = currentUserData?.lockReason ? `Reason: ${currentUserData.lockReason}` : '';
            return showToast(`Your account is locked. Please contact support. ${lockReason}`, true);
        }

        // Logic for non-tournament, limited-play games
        if (gameId && !tournamentId) { // Only apply this logic for standalone games, not tournament games
            const gameRef = db.ref(`games/${gameId}`);
            try {
                const { committed } = await gameRef.transaction(gameData => {
                    if (gameData && gameData.status === 'approved' && typeof gameData.play_limit === 'number') {
                        gameData.play_count = (gameData.play_count || 0) + 1;
                        
                        if (gameData.play_limit !== 0 && gameData.play_count >= gameData.play_limit) { // Only set to completed if limit is not 0
                            gameData.status = 'completed';
                            gameData.notified_play_limit_reached = false; 
                        }
                        return gameData;
                    }
                    return;
                });

                if (!committed) {
                    showToast("This game is no longer available or its play limit has been reached.", true);
                    renderHomePage(document.getElementById('homePage'));
                    return;
                }
                localStorage.setItem('game_played_pending', 'true');
            } catch (error) {
                console.error("Error updating play count for game:", error);
                showToast("Could not record your play due to an error. Please try again.", true);
                return;
            }
        }

        if (tournamentId) {
            localStorage.setItem('active_tournament_id', tournamentId);
            localStorage.setItem('game_start_time', Date.now());
        }
        window.location.href = url;
    }

    /**
     * NEW: Opens a banner link.
     * @param {string} url - The URL to open.
     */
    function openBannerLink(url) {
        if (!url) {
            showToast("Banner link is missing!", true);
            return;
        }
        window.open(url, '_blank'); // Open in a new tab/window
    }

    /**
     * Renders the Wallet Page content dynamically.
     * @param {HTMLElement} container - The container element for the wallet page.
     */
    async function renderWalletPage(container) {
        if (!auth.currentUser) {
            container.innerHTML = `
                <div class="p-4 bg-orange-50 min-h-screen flex flex-col items-center justify-center text-center">
                    <i class="fas fa-wallet fa-5x text-gray-400 mb-6"></i>
                    <p class="text-xl text-gray-700 font-semibold mb-4">Login to view your wallet balance and transactions.</p>
                    <button onclick="toggleModal('authModal', true)" class="text-white bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 p-3 rounded-lg font-bold shadow-md transition-all">
                        Login / Sign Up
                    </button>
                </div>`;
            return;
        }

        const wallet = currentUserData.wallet || { PKR: 0, INR: 0, USD: 0 };
        
        const pkrBalance = formatCurrency(wallet.PKR || 0, 'PKR');
        const inrBalance = formatCurrency(wallet.INR || 0, 'INR');
        const usdBalance = formatCurrency(wallet.USD || 0, 'USD');

        container.innerHTML = `<div class="p-4 bg-orange-50 min-h-screen">
                    <h2 class="text-2xl font-black mb-4 text-gray-800">Wallet</h2>
                    
                    <!-- Swiper Carousel for Balances -->
                    <div class="swiper walletSwiper mb-6 rounded-2xl shadow-lg bg-white overflow-hidden pb-8">
                        <div class="swiper-wrapper">
                            <!-- PKR Slide -->
                            <div class="swiper-slide">
                                <div class="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-8 text-center relative h-40 flex flex-col justify-center items-center">
                                    <div class="absolute top-0 left-0 w-full h-full bg-white/10" style="clip-path: polygon(0 0, 100% 0, 100% 20%, 0 100%);"></div>
                                    <p class="text-sm text-emerald-100 relative z-10 mb-1 font-semibold uppercase tracking-wider">Pakistani Rupee</p>
                                    <p class="text-4xl font-black tracking-tight relative z-10 drop-shadow-md">${pkrBalance}</p>
                                </div>
                            </div>
                            <!-- INR Slide -->
                            <div class="swiper-slide">
                                <div class="bg-gradient-to-br from-orange-500 to-red-600 text-white p-8 text-center relative h-40 flex flex-col justify-center items-center">
                                    <div class="absolute top-0 left-0 w-full h-full bg-white/10" style="clip-path: polygon(0 0, 100% 0, 100% 20%, 0 100%);"></div>
                                    <p class="text-sm text-orange-100 relative z-10 mb-1 font-semibold uppercase tracking-wider">Indian Rupee</p>
                                    <p class="text-4xl font-black tracking-tight relative z-10 drop-shadow-md">${inrBalance}</p>
                                </div>
                            </div>
                            <!-- USD Slide -->
                            <div class="swiper-slide">
                                <div class="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-8 text-center relative h-40 flex flex-col justify-center items-center">
                                    <div class="absolute top-0 left-0 w-full h-full bg-white/10" style="clip-path: polygon(0 0, 100% 0, 100% 20%, 0 100%);"></div>
                                    <p class="text-sm text-blue-100 relative z-10 mb-1 font-semibold uppercase tracking-wider">US Dollar</p>
                                    <p class="text-4xl font-black tracking-tight relative z-10 drop-shadow-md">${usdBalance}</p>
                                </div>
                            </div>
                        </div>
                        <!-- Add Pagination -->
                        <div class="swiper-pagination !bottom-1"></div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-8">
                        <button id="addMoneyBtn" onclick="if (checkFeatureLock('add_money')) toggleModal('addMoneyModal', true);" class="text-white bg-green-500 hover:bg-green-600 font-bold p-4 rounded-xl shadow-md transition transform active:scale-95"><i class="fas fa-plus-circle mr-2"></i>Add Cash</button>
                        <button id="withdrawMoneyBtn" onclick="if (checkFeatureLock('withdraw_money')) toggleModal('withdrawMoneyModal', true);" class="text-white bg-blue-500 hover:bg-blue-600 font-bold p-4 rounded-xl shadow-md transition transform active:scale-95"><i class="fas fa-arrow-circle-down mr-2"></i>Withdraw</button>
                        <button onclick="openExchangeCurrencyModal()" class="col-span-2 text-white bg-purple-500 hover:bg-purple-600 font-bold p-4 rounded-xl shadow-md transition transform active:scale-95"><i class="fas fa-exchange-alt mr-2"></i>Exchange Currency</button>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold mb-3 text-gray-700">Transaction History</h3>
                        <div id="transaction-list" class="space-y-3 pb-20"></div>
                    </div>
                </div>`;

        new Swiper(".walletSwiper", {
            spaceBetween: 0, centeredSlides: true, autoplay: { delay: 3000, disableOnInteraction: false }, pagination: { el: ".swiper-pagination", clickable: true }
        });

        const listEl = document.getElementById('transaction-list');
        listEl.innerHTML = `<p class="text-center text-gray-400 py-8 italic">Loading transactions...</p>`;

        try {
            const transactionsRef = db.ref(`transactions/${currentUserData.uid}`).orderByChild('created_at').limitToLast(20);
            const transactionsSnap = await transactionsRef.once('value');
            let allRecords = [];

            transactionsSnap.forEach(childSnap => {
                allRecords.push({ id: childSnap.key, ...childSnap.val() });
            });
            
            if (allRecords.length === 0) {
                listEl.innerHTML = `<p class="text-center text-gray-400 py-8 italic">No transactions yet.</p>`;
                return;
            }

            allRecords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            listEl.innerHTML = allRecords.map(t => {
                let bgColorClass, borderColorClass, amountClass, descriptionText, icon = '';
                const transactionCurrency = t.currency || 'PKR';

                if (t.type === 'credit') {
                    bgColorClass = 'bg-green-50'; borderColorClass = 'border-green-200'; amountClass = 'text-green-600'; icon = '<i class="fas fa-arrow-up mr-2"></i>';
                } else if (t.type === 'debit') {
                    bgColorClass = 'bg-red-50'; borderColorClass = 'border-red-200'; amountClass = 'text-red-600'; icon = '<i class="fas fa-arrow-down mr-2"></i>';
                } else if (t.type === 'exchange') {
                    bgColorClass = 'bg-purple-50'; borderColorClass = 'border-purple-200'; amountClass = 'text-purple-600'; icon = '<i class="fas fa-exchange-alt mr-2"></i>';
                } else {
                    bgColorClass = 'bg-gray-50'; borderColorClass = 'border-gray-200'; amountClass = 'text-gray-600'; icon = '<i class="fas fa-info-circle mr-2"></i>';
                }

                descriptionText = t.description;

                return `
                    <div class="p-4 rounded-xl flex justify-between items-center shadow-sm border ${bgColorClass} ${borderColorClass}">
                        <div>
                            <p class="font-bold text-sm text-gray-800">${icon}${descriptionText}</p>
                            <p class="text-xs text-gray-500 mt-1">${new Date(t.created_at).toLocaleString()}</p>
                        </div>
                        <p class="font-black text-lg ${amountClass}">
                            ${t.type === 'credit' ? '+' : (t.type === 'debit' || (t.type === 'exchange' && t.exchange_from_currency === transactionCurrency)) ? '-' : ''}${formatCurrency(t.amount, transactionCurrency)}
                        </p>
                    </div>`;
            }).join('');
        } catch (error) {
            console.error("Error fetching transactions:", error);
            listEl.innerHTML = `<p class="text-center text-red-400 py-8 italic">Error loading transactions.</p>`;
        }

        // NEW FEATURE: Update button states after rendering wallet content
        updateFeatureButtonStates();
    }


    /**
     * Renders the My Tournaments Page content dynamically.
     * @param {HTMLElement} container - The container element for the My Tournaments page.
     */
    async function renderMyTournamentsPage(container) {
        if (!auth.currentUser) {
            container.innerHTML = `
                        <div class="p-4 bg-orange-50 min-h-screen flex flex-col items-center justify-center text-center">
                            <i class="fas fa-trophy fa-5x text-gray-400 mb-6"></i>
                            <p class="text-xl text-gray-700 font-semibold mb-4">Login to view your joined tournaments and match history.</p>
                            <button onclick="toggleModal('authModal', true)" class="text-white bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 p-3 rounded-lg font-bold shadow-md transition-all">
                                Login / Sign Up
                            </button>
                        </div>`;
            return;
        }

        container.innerHTML = `<div class="p-4 bg-orange-50 min-h-screen"><h2 class="text-2xl font-black mb-4 text-gray-800">My Matches</h2><div class="flex border-b border-gray-300 mb-4"><button id="upcomingLiveTab" class="flex-1 py-2 text-center font-bold border-b-4 border-red-500 text-red-600">Upcoming/Live</button><button id="completedTab" class="flex-1 py-2 text-center font-bold text-gray-400 border-b-4 border-transparent">Completed</button></div><div id="upcomingLiveContent" class="space-y-4"></div><div id="completedContent" class="space-y-4" style="display:none;"></div></div>`;
        attachMyTournamentsListeners();

        try {
            const allTournaments = (await db.ref('tournaments').once('value')).val() || {};
            let upcomingHtml = '', completedHtml = '', hasUpcoming = false, hasCompleted = false;
            for (const tId in allTournaments) {
                if (!currentUserData || !currentUserData.uid) {
                    console.warn("currentUserData or UID missing in renderMyTournamentsPage, skipping participant check.");
                    continue;
                }
                const participant = (await db.ref(`participants/${tId}/${currentUserData.uid}`).once('value')).val();
                if (participant) {
                    const t = allTournaments[tId];
                    if (t.status !== 'Completed') {
                        hasUpcoming = true;
                        upcomingHtml += `<div class="bg-white border-l-4 border-red-500 rounded-lg p-4 shadow-md">
                                    <div class="flex justify-between items-center mb-2"><h3 class="font-bold text-lg text-gray-800">${escapeJsStringForHtmlAttribute(t.title)}</h3><span class="text-xs font-bold ${t.status === 'Live' ? 'text-white bg-red-600 animate-pulse' : 'text-yellow-800 bg-yellow-200'} px-2 py-1 rounded-full">${t.status}</span></div>
                                    <p class="text-sm text-gray-500 mb-2">${escapeJsStringForHtmlAttribute(t.game_name)}</p>
                                    ${t.status === 'Live' ? `
                                        ${t.room_id ? `<div class="bg-gray-100 p-3 rounded text-sm mb-3"><p><span class="font-bold text-gray-600">Room ID:</span> ${escapeJsStringForHtmlAttribute(t.room_id)}</p><p><span class="font-bold text-gray-600">Pass:</span> ${escapeJsStringForHtmlAttribute(t.room_password)}</p></div>` : ''}
                                        <button onclick="checkLoginAndAct(event, 'playGameUrl', null, '${escapeJsStringForHtmlAttribute(t.game_url)}', '${escapeJsStringForHtmlAttribute(tId)}')" class="w-full text-white bg-gradient-to-r from-green-500 to-green-600 font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition transform active:scale-95 animate-pulse">PLAY LIVE MATCH</button>
                                    ` : `<p class="text-xs text-gray-400 italic mb-3">Room details appear here when Live.</p>`}
                                </div>`;
                    } else {
                        hasCompleted = true;
                        completedHtml += `<div class="bg-gray-100 border border-gray-200 rounded-lg p-4 flex justify-between items-center shadow-sm opacity-80">
                                    <div><h3 class="font-bold text-gray-700">${escapeJsStringForHtmlAttribute(t.title)}</h3><p class="text-xs text-gray-500">${new Date(t.match_time).toLocaleDateString()}</p></div>
                                    <span class="font-bold ${participant.status === 'Winner' ? 'text-green-600' : 'text-gray-500'}">${participant.status || 'Played'}</span>
                                </div>`;
                    }
                }
            }
            document.getElementById('upcomingLiveContent').innerHTML = hasUpcoming ? upcomingHtml : `<p class="text-center text-gray-500 py-8">No matches joined.</p>`;
            document.getElementById('completedContent').innerHTML = hasCompleted ? completedHtml : `<p class="text-center text-gray-500 py-8">No history available.</p>`;
        } catch (error) {
            console.error("Error loading my tournaments:", error);
            document.getElementById('upcomingLiveContent').innerHTML = `<p class="text-center text-red-500 italic py-8">Error loading matches.</p>`;
            document.getElementById('completedContent').innerHTML = `<p class="text-center text-red-500 italic py-8">Error loading matches history.</p>`;
        }
    }

    /**
     * Renders the Notifications Page content dynamically.
     * @param {HTMLElement} container - The container element for the notifications page.
     */
    async function renderNotificationsPage(container) {
        if (!auth.currentUser) {
            container.innerHTML = `
                <div class="p-4 bg-orange-50 min-h-screen flex flex-col items-center justify-center text-center">
                    <i class="fas fa-bell fa-5x text-gray-400 mb-6"></i>
                    <p class="text-xl text-gray-700 font-semibold mb-4">Login to view your notifications.</p>
                    <button onclick="toggleModal('authModal', true)" class="text-white bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 p-3 rounded-lg font-bold shadow-md transition-all">
                        Login / Sign Up
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="p-4 bg-orange-50 min-h-screen">
                <h2 class="text-2xl font-black mb-4 text-gray-800">Your Notifications</h2>
                <div class="flex justify-end mb-4">
                    <button onclick="markAllNotificationsAsRead()" class="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors">
                        Mark All as Read
                    </button>
                </div>
                <div id="notifications-list" class="space-y-3 pb-20">
                    <p class="text-center text-gray-400 italic">Loading notifications...</p>
                </div>
            </div>`;

        const listEl = document.getElementById('notifications-list');
        const userId = auth.currentUser.uid;

        try {
            db.ref(`notifications/${userId}`).orderByChild('timestamp').on('value', snapshot => {
                const notificationsData = snapshot.val();
                if (!notificationsData) {
                    listEl.innerHTML = `<p class="text-center text-gray-400 italic">No notifications yet.</p>`;
                    return;
                }

                const notificationsArray = [];
                for (const id in notificationsData) {
                    notificationsArray.push({ id, ...notificationsData[id] });
                }

                notificationsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                listEl.innerHTML = notificationsArray.map(notif => {
                    const isUnread = notif.status === 'unread';
                    const itemClass = isUnread ? 'notification-item unread' : 'notification-item';
                    const timeAgo = formatTimeAgo(notif.timestamp);

                    return `
                        <div class="${itemClass} p-4 rounded-xl shadow-sm border border-orange-100 cursor-pointer" onclick="markNotificationAsRead('${escapeJsStringForHtmlAttribute(notif.id)}')">
                            <h3 class="font-bold text-gray-800">${escapeJsStringForHtmlAttribute(notif.title || 'Notification')}</h3>
                            <p class="text-sm text-gray-600 mt-1">${escapeJsStringForHtmlAttribute(notif.message)}</p>
                            <p class="text-xs text-gray-500 mt-2">${timeAgo}</p>
                        </div>
                    `;
                }).join('');
            });
        } catch (error) {
            console.error("Error loading notifications:", error);
            listEl.innerHTML = `<p class="text-center text-red-500 italic py-8">Error loading notifications.</p>`;
        }
    }

    /**
     * Formats a timestamp into a human-readable "time ago" string.
     * @param {string} timestamp - The ISO string timestamp.
     * @returns {string} The formatted time ago string.
     */
    function formatTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffSeconds = Math.round((now.getTime() - past.getTime()) / 1000);

        const minutes = Math.round(diffSeconds / 60);
        const hours = Math.round(diffSeconds / 3600);
        const days = Math.round(diffSeconds / (3600 * 24));

        if (diffSeconds < 60) return `${diffSeconds} sec ago`;
        if (minutes < 60) return `${minutes} min ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }


    /**
     * Marks a single notification as read in Firebase.
     * @param {string} notificationId - The ID of the notification to mark as read.
     */
    async function markNotificationAsRead(notificationId) {
        if (!auth.currentUser || !notificationId) return;
        try {
            await db.ref(`notifications/${auth.currentUser.uid}/${notificationId}`).update({ status: 'read', read_at: new Date().toISOString() });
        } catch (error) {
            console.error("Error marking notification as read:", error);
            showToast('Failed to mark notification as read.', true);
        }
    }

    /**
     * Marks all unread notifications for the current user as read.
     */
    async function markAllNotificationsAsRead() {
        if (!auth.currentUser) return;
        try {
            const unreadSnap = await db.ref(`notifications/${auth.currentUser.uid}`).orderByChild('status').equalTo('unread').once('value');
            const updates = {};
            unreadSnap.forEach(childSnap => {
                updates[`notifications/${auth.currentUser.uid}/${childSnap.key}/status`] = 'read';
                updates[`notifications/${auth.currentUser.uid}/${childSnap.key}/read_at`] = new Date().toISOString();
            });
            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                showToast('All notifications marked as read!');
            } else {
                showToast('No unread notifications to mark.', false);
            }
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
            showToast('Failed to mark all notifications as read.', true);
        }
    }


    /**
     * Renders the Profile Page content dynamically.
     * @param {HTMLElement} container - The container element for the profile page.
     */
    function renderProfilePage(container) {
        if (!auth.currentUser) {
            container.innerHTML = `
                        <div class="p-4 bg-orange-50 min-h-screen flex flex-col items-center justify-center text-center">
                            <i class="fas fa-user-cog fa-5x text-gray-400 mb-6"></i>
                            <p class="text-xl text-gray-700 font-semibold mb-4">Login to view and manage your profile.</p>
                            <button onclick="toggleModal('authModal', true)" class="text-white bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-700 hover:to-yellow-600 p-3 rounded-lg font-bold shadow-md transition-all">
                                Login / Sign Up
                            </button>
                        </div>`;
            return;
        }

        const userReferralCode = currentUserData?.username || '';
        const referralsEarned = currentUserData?.referrals_earned_count || 0;
        const preferredCurrency = currentUserData?.preferred_currency || 'PKR';

        // Updated HTML structure for "My Submitted Games" to be a details/summary accordion
        container.innerHTML = `
                    <div class="p-4 space-y-6 bg-orange-50 min-h-screen">
                        <h2 class="text-2xl font-black mb-4 text-gray-800">Profile & Settings</h2>

                        <div id="mainProfileView" class="space-y-6">
                            <!-- User Profile Details -->
                            <div class="bg-white border border-orange-100 p-6 rounded-xl shadow-md text-center">
                                <div class="w-20 h-20 bg-gradient-to-br from-red-500 to-yellow-500 rounded-full mx-auto flex items-center justify-center text-3xl text-white font-bold mb-3">
                                    ${currentUserData?.username ? currentUserData.username[0].toUpperCase() : 'U'}
                                </div>
                                <p class="text-xl font-bold text-gray-800">${escapeJsStringForHtmlAttribute(currentUserData?.username || 'User')}</p>
                                <p class="text-sm text-gray-500">${escapeJsStringForHtmlAttribute(currentUserData?.email || auth.currentUser?.email || 'N/A')}</p>
                                <div class="mt-4 pt-4 border-t border-orange-100">
                                    <p class="text-md font-semibold text-gray-700">Referrals Joined: <span class="font-bold text-green-600" id="profile-referrals-count">${referralsEarned}</span></p>
                                </div>
                            </div>

                            <!-- Wallet Settings -->
                            <div class="bg-white border border-orange-100 p-6 rounded-xl shadow-md space-y-4">
                                <h3 class="font-bold text-lg text-gray-800">My Wallet Settings</h3>
                                <label class="block"><span class="text-gray-700 text-sm">Preferred Display Currency:</span>
                                    <select id="preferred-currency-select" class="w-full p-3 mt-1 bg-gray-50 rounded border border-gray-200 text-gray-700">
                                        <option value="PKR" ${preferredCurrency === 'PKR' ? 'selected' : ''}>Pakistani Rupee (PKR)</option>
                                        <option value="INR" ${preferredCurrency === 'INR' ? 'selected' : ''}>Indian Rupee (INR)</option>
                                        <option value="USD" ${preferredCurrency === 'USD' ? 'selected' : ''}>US Dollar (USD)</option>
                                    </select>
                                </label>
                                <p class="text-xs text-gray-500 italic mt-1">This sets the default currency displayed in your wallet and header.</p>
                            </div>
                            
                            <!-- Referral Code Section -->
                            <div class="bg-white border border-orange-100 p-6 rounded-xl shadow-md space-y-4">
                                <h3 class="font-bold text-lg text-gray-800">Invite Friends & Earn!</h3>
                                <p class="text-sm text-gray-600">Share your username as referral code. You get <span class="font-bold text-green-600">PKR  <span id="referral-bonus-text">${referralBonusAmount}</span></span> for every friend who signs up!</p>
                                <div class="flex items-center space-x-2">
                                    <input type="text" id="referralLinkInput" value="${escapeJsStringForHtmlAttribute(userReferralCode)}" readonly class="flex-1 p-2 bg-gray-100 rounded border border-gray-200 text-sm overflow-hidden text-ellipsis">
                                    <button onclick="copyReferralLink()" class="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 transition">Copy Code</button>
                                </div>
                                <p class="text-xs text-gray-500 italic mt-2">Friends must enter your username during signup to count as your referral.</p>
                            </div>

                            <!-- Download App Button Section -->
                            <div class="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-xl shadow-lg text-center mt-6">
                                <h3 class="font-bold text-xl mb-3">Get the Full App Experience!</h3>
                                <p class="text-sm text-red-100 mb-4">Download our app from the Play Store for exclusive features and a smoother experience.</p>
                                <a href="https://play.google.com/store/apps/details?id=com.edu.my" target="_blank" rel="noopener noreferrer"
                                   class="inline-block bg-white text-red-600 px-6 py-3 rounded-full font-bold shadow-md hover:shadow-xl transition transform hover:scale-105 active:scale-95">
                                    <i class="fab fa-google-play mr-2"></i> Download on Play Store
                                </a>
                            </div>

                            <!-- Claim Daily Bonus Button -->
                            <button onclick="claimDailyBonus()" class="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white p-3 rounded-xl font-bold shadow-md hover:from-green-600 hover:to-blue-600 transition">
                                <i class="fas fa-gift mr-2"></i> Claim Daily Bonus
                            </button>
                            <p class="text-xs text-gray-600 text-center mt-2">
                                Claim <strong>PKR 100 - 1000</strong> daily! <br>
                                Withdrawal requires <strong>20 referrals</strong> who each deposited <strong>PKR 100</strong>.
                            </p>
                            
                            <!-- Add New Game Button -->
                            <button id="addGameBtn" onclick="if (checkFeatureLock('add_game')) toggleModal('addGameModal', true);" class="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white p-3 rounded-xl font-bold shadow-md hover:from-orange-600 hover:to-yellow-600 transition">
                                <i class="fas fa-plus-circle mr-2"></i> Add New Game
                            </button>

                            <!-- My Submitted Games Section as an accordion -->
                            <details class="submitted-games-accordion bg-white p-3 rounded-xl shadow-md border border-orange-100">
                                <summary class="flex items-center justify-between text-gray-800 font-bold">
                                    <span><i class="fas fa-gamepad mr-3 text-red-500"></i>My Submitted Games</span>
                                </summary>
                                <div id="my-submitted-games-list" class="space-y-3 mt-4">
                                    <p class="text-center text-gray-400 italic">Loading your games...</p>
                                </div>
                            </details>
                            <!-- End My Submitted Games Section -->

                            <!-- Reset Password Button -->
                            <button onclick="changePassword()" class="w-full bg-white text-gray-700 border border-gray-300 p-3 rounded-xl font-bold shadow-sm">Reset Password</button>

                            <!-- NEW MENU for Policies & Contact -->
                            <div id="policyMenuButtons" class="space-y-4 pt-4 border-t border-orange-100">
                                <button class="w-full bg-white text-gray-700 border border-gray-300 p-4 rounded-xl font-bold shadow-sm flex items-center justify-between transition transform hover:scale-105 active:scale-95" onclick="showPolicySection('privacy_policy')">
                                    <span><i class="fas fa-shield-alt mr-3 text-blue-500"></i>Privacy Policy</span> <i class="fas fa-chevron-right text-gray-400"></i>
                                </button>
                                <button class="w-full bg-white text-gray-700 border border-gray-300 p-4 rounded-xl font-bold shadow-sm flex items-center justify-between transition transform hover:scale-105 active:scale-95" onclick="showPolicySection('about_us')">
                                    <span><i class="fas fa-info-circle mr-3 text-green-500"></i>About Us</span> <i class="fas fa-chevron-right text-gray-400"></i>
                                </button>
                                <button class="w-full bg-white text-gray-700 border border-gray-300 p-4 rounded-xl font-bold shadow-sm flex items-center justify-between transition transform hover:scale-105 active:scale-95" onclick="showPolicySection('terms_conditions')">
                                    <span><i class="fas fa-file-contract mr-3 text-purple-500"></i>Terms & Conditions</span> <i class="fas fa-chevron-right text-gray-400"></i>
                                </button>
                                <button class="w-full bg-white text-gray-700 border border-gray-300 p-4 rounded-xl font-bold shadow-sm flex items-center justify-between transition transform hover:scale-105 active:scale-95" onclick="showPolicySection('deposit_rules')">
                                    <span><i class="fas fa-money-bill-wave mr-3 text-orange-500"></i>Deposit Rules</span> <i class="fas fa-chevron-right text-gray-400"></i>
                                </button>
                                <button class="w-full bg-white text-gray-700 border border-gray-300 p-4 rounded-xl font-bold shadow-sm flex items-center justify-between transition transform hover:scale-105 active:scale-95" onclick="showPolicySection('withdrawal_rules')">
                                    <span><i class="fas fa-cash-register mr-3 text-teal-500"></i>Withdrawal Rules</span> <i class="fas fa-chevron-right text-gray-400"></i>
                                </button>
                                <button class="w-full bg-white text-gray-700 border border-gray-300 p-4 rounded-xl font-bold shadow-sm flex items-center justify-between transition transform hover:scale-105 active:scale-95" onclick="showMySupportMessages()">
                                    <span><i class="fas fa-inbox mr-3 text-gray-500"></i>My Support Messages</span> <i class="fas fa-chevron-right text-gray-400"></i>
                                </button>
                            </div>

                            <button onclick="logout()" class="w-full text-white bg-gradient-to-r from-red-500 to-red-700 p-3 rounded-xl font-bold shadow-md">Logout</button>
                        </div>

                        <!-- Policy Content Sections (initially hidden) -->
                        <div id="policyContentArea" class="space-y-4" style="display:none;">
                            <button onclick="showMainProfileView()" class="w-full bg-gray-200 text-gray-700 p-3 rounded-xl font-bold shadow-sm mb-4 transition transform hover:scale-105 active:scale-95"><i class="fas fa-arrow-left mr-2"></i>Back to Profile</button>

                            <div id="policy-content-display" class="bg-white border border-orange-100 p-6 rounded-xl shadow-md" style="display:none;">
                                <h3 class="font-bold text-lg mb-4 text-gradient" id="policy-display-title"></h3>
                                <div class="text-gray-700 text-sm leading-relaxed space-y-3" id="policy-display-body"></div>
                            </div>

                            <!-- NEW: My Support Messages Section -->
                            <div id="mySupportMessagesSection" class="bg-white border border-orange-100 p-6 rounded-xl shadow-md" style="display:none;">
                                <div class="flex justify-between items-center mb-4">
                                    <h3 class="font-bold text-lg text-gradient">My Support Messages</h3>
                                    <button onclick="toggleModal('contactUsModal', true)" class="bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow"><i class="fas fa-plus-circle mr-1"></i> New Message</button>
                                </div>
                                <div id="user-contact-messages-list" class="space-y-3">
                                    <p class="text-center text-gray-400 italic">Loading your messages...</p>
                                </div>
                            </div>
                        </div>
                    </div>`;
        
        document.getElementById('preferred-currency-select').addEventListener('change', updateUserPreferredCurrency);
        updateProfileContent();
        renderMySubmittedGames(); // Call the function to populate the submitted games list
        updateFeatureButtonStates(); // NEW FEATURE: Update button states after rendering profile content
    }

    /**
     * Renders the list of games submitted by the current user with their play counts.
     */
    function renderMySubmittedGames() {
        const listEl = document.getElementById('my-submitted-games-list');
        if (!auth.currentUser || !listEl) {
            listEl.innerHTML = `<p class="text-center text-gray-500 italic">Login to view your submitted games.</p>`;
            return;
        }

        const userId = auth.currentUser.uid;
        db.ref('games').orderByChild('created_by').equalTo(userId).on('value', snapshot => {
            const gamesData = snapshot.val();
            if (!gamesData) {
                listEl.innerHTML = `<p class="text-center text-gray-500 italic">You have not submitted any games yet.</p>`;
                return;
            }

            const submittedGames = [];
            for (const gameId in gamesData) {
                const game = gamesData[gameId];
                if (game.status === 'approved' || game.status === 'completed' || game.status === 'pending') { 
                    submittedGames.push({ id: gameId, ...game });
                }
            }

            if (submittedGames.length === 0) {
                listEl.innerHTML = `<p class="text-center text-gray-500 italic">You have no active games. Games appear here once approved by admin.</p>`;
                return;
            }
            
            submittedGames.sort((a, b) => a.title.localeCompare(b.title));

            listEl.innerHTML = submittedGames.map(game => {
                const currentPlays = game.play_count || 0;
                const playLimit = game.play_limit || 0;
                const progressPercentage = playLimit > 0 ? Math.min((currentPlays / playLimit) * 100, 100) : 0;

                let gameStatusText;
                let statusColorClass;
                switch (game.status) {
                    case 'approved':
                        gameStatusText = 'Live';
                        statusColorClass = 'text-green-600 bg-green-100';
                        break;
                    case 'completed':
                        gameStatusText = 'Limit Reached';
                        statusColorClass = 'text-red-600 bg-red-100';
                        break;
                    case 'pending':
                        gameStatusText = 'Pending Approval';
                        statusColorClass = 'text-yellow-600 bg-yellow-100';
                        break;
                    case 'rejected':
                        gameStatusClass = 'text-red-800 bg-gray-200';
                        gameStatusText = 'Rejected (Refunded)';
                        break;
                    default:
                        gameStatusText = 'Unknown';
                        statusColorClass = 'text-gray-600 bg-gray-100';
                }
                
                const reAddButton = game.status === 'completed' 
                    ? `<button onclick="if (checkFeatureLock('add_game')) toggleModal('addGameModal', true);" class="text-white bg-blue-500 hover:bg-blue-600 py-1 px-3 rounded-md text-xs font-semibold mt-2">Re-add Game</button>`
                    : '';

                return `
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div class="flex justify-between items-center mb-1">
                            <p class="font-semibold text-gray-800">${escapeJsStringForHtmlAttribute(game.title)}</p>
                            <span class="text-xs font-bold px-2 py-0.5 rounded-full ${statusColorClass}">${gameStatusText}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                            <div class="bg-gradient-to-r from-red-500 to-yellow-500 h-2.5 rounded-full" style="width: ${progressPercentage}%"></div>
                        </div>
                        <p class="text-xs text-right text-gray-600 mt-1 font-mono">Plays: <strong class="font-bold">${currentPlays}</strong> / ${playLimit === 0 ? 'Unlimited' : playLimit}</p>
                        ${reAddButton}
                    </div>
                `;
            }).join('');
        }, (error) => {
            console.error("Error loading user's submitted games:", error);
            listEl.innerHTML = `<p class="text-center text-red-500 italic py-8">Error loading your games.</p>`;
        });
    }


    /**
     * NEW FEATURE: Updates the disabled state and styling of feature buttons based on `appFeatureControls`.
     */
    function updateFeatureButtonStates() {
        const addMoneyBtn = document.getElementById('addMoneyBtn');
        const withdrawMoneyBtn = document.getElementById('withdrawMoneyBtn');
        const addGameBtn = document.getElementById('addGameBtn');

        const applyState = (button, featureKey) => {
            if (!button) return;
            const control = appFeatureControls[featureKey] || { locked: false, reason: '' };
            if (control.locked) {
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.classList.remove('hover:from-green-600', 'hover:to-green-600', 'hover:from-blue-600', 'hover:to-blue-600', 'hover:from-orange-600', 'hover:to-yellow-600');
            } else {
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
                // Restore hover effects based on original colors (can be more specific if needed)
                if (featureKey === 'add_money') button.classList.add('hover:bg-green-600');
                else if (featureKey === 'withdraw_money') button.classList.add('hover:bg-blue-600');
                else if (featureKey === 'add_game') button.classList.add('hover:from-orange-600', 'hover:to-yellow-600');
            }
        };

        applyState(addMoneyBtn, 'add_money');
        applyState(withdrawMoneyBtn, 'withdraw_money');
        applyState(addGameBtn, 'add_game');
    }

    /**
     * NEW FEATURE: Handles click on a locked feature button.
     * Displays a toast with the lock reason.
     * @param {string} featureName - The name of the feature (e.g., 'add_money').
     * @returns {boolean} True if the feature is unlocked, false if locked.
     */
    function checkFeatureLock(featureName) {
        const control = appFeatureControls[featureName];
        if (control && control.locked) {
            showToast(control.reason || `This feature (${featureName.replace(/_/g, ' ')}) is currently locked by the admin.`, true);
            return false;
        }
        return true;
    }


    function updateProfileContent() {
        if (currentUserData) {
            const usernameEl = document.querySelector('#mainProfileView .text-xl.font-bold');
            if (usernameEl) usernameEl.textContent = currentUserData.username || 'User';
            const emailEl = document.querySelector('#mainProfileView .text-sm.text-gray-500');
            if (emailEl) emailEl.textContent = currentUserData.email || auth.currentUser?.email || 'N/A';

            const referralsEarnedEl = document.getElementById('profile-referrals-count');
            if (referralsEarnedEl) {
                const countToDisplay = currentUserData.referrals_earned_count || 0;
                referralsEarnedEl.textContent = countToDisplay;
            }

            const referralLinkInput = document.getElementById('referralLinkInput');
            if (referralLinkInput) {
                referralLinkInput.value = currentUserData.username || '';
            }

            const referralBonusTextEl = document.getElementById('referral-bonus-text');
            if (referralBonusTextEl) {
                referralBonusTextEl.textContent = referralBonusAmount;
            }

            const withdrawAmountInput = document.getElementById('withdraw-amount');
            if (withdrawAmountInput) {
                withdrawAmountInput.placeholder = `Min ${formatCurrency(minWithdrawalAmount, 'PKR')}`;
            }

            const adminDepositNumEl = document.getElementById('admin-deposit-number');
            if (adminDepositNumEl) {
                adminDepositNumEl.textContent = adminDepositNumber;
            }
        } else {
            console.warn("DEBUG: updateProfileContent called but currentUserData is null.");
        }
    }

    /**
     * Copies the referral username to the clipboard.
     */
    function copyReferralLink() {
        const referralLinkInput = document.getElementById('referralLinkInput');
        if (referralLinkInput) {
            referralLinkInput.select();
            referralLinkInput.setSelectionRange(0, 99999);
            document.execCommand('copy');
            showToast('Referral username copied!');
        }
    }

    /**
     * Attaches event listeners for the login/signup tabs and forms in the auth modal.
     */
    function attachLoginListeners() {
        const loginTab = document.getElementById('loginTabBtnModal');
        const signupTab = document.getElementById('signupTabBtnModal');
        const loginForm = document.getElementById('loginFormModal');
        const signupForm = document.getElementById('signupFormModal');

        const signupUsernameModal = document.getElementById('signupUsernameModal');
        const usernameAvailability = document.getElementById('usernameAvailability');
        const signupSubmitBtn = document.getElementById('signupSubmitBtn');
        const signupReferralCodeModal = document.getElementById('signupReferralCodeModal');

        if (!loginTab || !signupTab || !loginForm || !signupForm || !signupUsernameModal || !usernameAvailability || !signupSubmitBtn || !signupReferralCodeModal) {
            console.warn("Auth modal elements not found, skipping attaching listeners.");
            return;
        }

        signupSubmitBtn.disabled = true;

        loginTab.addEventListener('click', () => {
            loginTab.className = "flex-1 py-2 text-center font-bold border-b-4 border-red-500 text-red-600";
            signupTab.className = "flex-1 py-2 text-center font-bold text-gray-400 border-b-4 border-transparent";
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            signupSubmitBtn.disabled = true;
            usernameAvailability.textContent = '';
            signupUsernameModal.value = '';
            signupReferralCodeModal.value = '';
        });

        signupTab.addEventListener('click', () => {
            signupTab.className = "flex-1 py-2 text-center font-bold border-b-4 border-red-500 text-red-600";
            loginTab.className = "flex-1 py-2 text-center font-bold text-gray-400 border-b-4 border-transparent";
            signupForm.style.display = 'block';
            loginForm.style.display = 'none';
            signupSubmitBtn.disabled = true;
            usernameAvailability.textContent = '';
            signupUsernameModal.value = '';
            signupReferralCodeModal.value = '';
        });

        let usernameTimer;
        signupUsernameModal.addEventListener('input', () => {
            clearTimeout(usernameTimer);
            const username = signupUsernameModal.value.trim();

            if (username.length < 3) {
                usernameAvailability.textContent = 'Username must be at least 3 characters.';
                usernameAvailability.className = 'text-xs mt-1 text-red-500';
                signupSubmitBtn.disabled = true;
                return;
            }
            if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
                usernameAvailability.textContent = 'Invalid characters. Use letters, numbers, _, ., -';
                usernameAvailability.className = 'text-xs mt-1 text-red-500';
                signupSubmitBtn.disabled = true;
                return;
            }

            usernameAvailability.textContent = 'Checking availability...';
            usernameAvailability.className = 'text-xs mt-1 text-gray-500';
            signupSubmitBtn.disabled = true;

            usernameTimer = setTimeout(async () => {
                try {
                    const snap = await db.ref('usernames/' + username.toLowerCase()).once('value');
                    if (snap.exists()) {
                        usernameAvailability.textContent = 'Username is already taken.';
                        usernameAvailability.className = 'text-xs mt-1 text-red-500';
                        signupSubmitBtn.disabled = true;
                    } else {
                        usernameAvailability.textContent = 'Username is available!';
                        usernameAvailability.className = 'text-xs mt-1 text-green-500';
                        signupSubmitBtn.disabled = false;
                    }
                } catch (error) {
                    console.error("Error checking username availability:", error);
                    usernameAvailability.textContent = 'Error checking username.';
                    usernameAvailability.className = 'text-xs mt-1 text-red-500';
                    signupSubmitBtn.disabled = true;
                }
            }, 500);
        });

        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            try {
                await auth.signInWithEmailAndPassword(e.target.loginEmailModal.value, e.target.loginPasswordModal.value);
                showToast('Login successful!');
                toggleModal('authModal', false);
                e.target.reset();
            } catch (err) {
                showToast(err.message, true);
            }
        });

        signupForm.addEventListener('submit', async e => {
            e.preventDefault();
            const { signupUsernameModal, signupEmailModal, signupPasswordModal, signupReferralCodeModal } = e.target;
            const enteredReferralCode = signupReferralCodeModal.value.trim().toLowerCase();
            const username = signupUsernameModal.value.trim();

            try {
                const finalCheckSnap = await db.ref('usernames/' + username.toLowerCase()).once('value');
                if (finalCheckSnap.exists()) {
                    showToast('Username is already taken. Please choose another.', true);
                    signupUsernameModal.focus();
                    return;
                }

                const cred = await auth.createUserWithEmailAndPassword(signupEmailModal.value, signupPasswordModal.value);
                const newUserId = cred.user.uid;

                const initialSignupBonus = signupBonusAmount;
                const referralBonus = referralBonusAmount;

                let newUserData = {
                    username: username,
                    email: signupEmailModal.value,
                    wallet: { PKR: initialSignupBonus, INR: 0, USD: 0 },
                    preferred_currency: 'PKR',
                    referrals_earned_count: 0,
                    created_at: new Date().toISOString(),
                    locked: false,
                    lockReason: null
                };
                newUserData.referral_code = username.toLowerCase();

                let feedbackMessage = `Signup successful! You got ${formatCurrency(initialSignupBonus, 'PKR')} 🎉`;

                if (enteredReferralCode && enteredReferralCode !== username.toLowerCase()) {
                    const refSnap = await db.ref('usernames/' + enteredReferralCode).once('value');

                    if (refSnap.exists()) {
                        const referrerUid = refSnap.val();
                        await db.ref(`users/${referrerUid}`).transaction((data) => {
                            if (data) {
                                if (!data.wallet) data.wallet = { PKR: data.wallet_balance || 0, INR: 0, USD: 0 };
                                data.wallet.PKR = (data.wallet.PKR !== null && typeof data.wallet.PKR === 'number' ? data.wallet.PKR : 0) + referralBonus;
                                data.referrals_earned_count = (data.referrals_earned_count || 0) + 1;
                            }
                            return data;
                        });
                        await db.ref(`transactions/${referrerUid}`).push({
                            amount: referralBonus,
                            type: "credit",
                            currency: 'PKR',
                            description: `Referral bonus from ${username}`,
                            created_at: new Date().toISOString()
                        });
                        newUserData.referred_by_username = enteredReferralCode;
                        feedbackMessage = `Signup successful! You got ${formatCurrency(initialSignupBonus, 'PKR')} & referrer rewarded 🎉`;
                    } else {
                        feedbackMessage = `Signup successful! You got ${formatCurrency(initialSignupBonus, 'PKR')} (Invalid referral code)`;
                    }
                } else if (enteredReferralCode === username.toLowerCase()) {
                    feedbackMessage = `Signup successful! You got ${formatCurrency(initialSignupBonus, 'PKR')} (Cannot refer yourself)`;
                }

                const userRef = db.ref('users/' + newUserId);
                const snap = await userRef.once('value');

                if (!snap.exists()) {
                    await userRef.set(newUserData);
                } else {
                    await userRef.update({
                        wallet: newUserData.wallet,
                        preferred_currency: newUserData.preferred_currency,
                        username: newUserData.username,
                        email: newUserData.email,
                        referral_code: newUserData.referral_code,
                        referred_by_username: newUserData.referred_by_username || null,
                        created_at: newUserData.created_at,
                        locked: newUserData.locked,
                        lockReason: newUserData.lockReason
                    });
                }

                await db.ref('usernames/' + username.toLowerCase()).set(newUserId);

                await db.ref(`transactions/${newUserId}`).push({
                    amount: initialSignupBonus,
                    type: "credit",
                    currency: 'PKR',
                    description: "Signup Bonus",
                    created_at: new Date().toISOString()
                });

                showToast(feedbackMessage);

                toggleModal('authModal', false);
                signupForm.reset();
                signupReferralCodeModal.value = '';
                usernameAvailability.textContent = '';

            } catch (err) {
                console.error("Signup Error:", err);
                showToast(err.message, true);
            }
        });
    }

    /**
     * Handles claiming daily bonus.
     */
    async function claimDailyBonus() {
        if (!auth.currentUser) {
            showToast('Login required to claim daily bonus!', true);
            return;
        }
        if (!currentUserData || currentUserData.locked) { 
            auth.signOut();
            const lockReason = currentUserData?.lockReason ? `Reason: ${currentUserData.lockReason}` : '';
            return showToast(`Your account is locked. Please contact support. ${lockReason}`, true);
        }

        const userUid = auth.currentUser.uid;
        const userRef = db.ref(`users/${userUid}`);

        try {
            const snap = await userRef.once('value');
            const userData = snap.val();

            if (!userData) {
                showToast('User data not found. Please try logging in again.', true);
                window.open('https://toolswebsite205.blogspot.com', '_blank'); 
                return;
            }

            const lastClaimTimestamp = userData.last_daily_bonus_claim_timestamp || 0;
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (Date.now() - lastClaimTimestamp < twentyFourHours) {
                const timeLeft = twentyFourHours - (Date.now() - lastClaimTimestamp);
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                showToast(`You can claim your next daily bonus in ${hours}h ${minutes}m.`, true);
                
                window.open('https://toolswebsite205.blogspot.com', '_blank'); 
                return;
            }

            const randomBonus = Math.floor(Math.random() * 80) + 10;
            
            let committed = false;
            const walletRef = db.ref(`users/${userUid}/wallet/PKR`);

            await walletRef.transaction(data => {
                const balance = data !== null && typeof data === 'number' ? data : 0;
                return balance + randomBonus;
            }, (error, _committed, snapshot) => {
                if (error) {
                    console.error("Daily bonus transaction failed: ", error);
                    showToast("Failed to claim daily bonus. Please try again.", true);
                } else if (_committed) {
                    committed = true;
                    db.ref(`transactions/${userUid}`).push({
                        amount: randomBonus,
                        type: 'credit',
                        currency: 'PKR',
                        description: 'Daily Bonus',
                        created_at: new Date().toISOString()
                    });
                    userRef.update({
                        last_daily_bonus_claim_timestamp: Date.now(),
                        daily_bonus_withdrawal_condition_active: true
                    }).then(() => {
                        showToast(`💰 You claimed ${formatCurrency(randomBonus, 'PKR')} daily bonus!`, false);
                        window.open('https://toolswebsite205.blogspot.com', '_blank'); 
                        if (document.getElementById('walletPage').classList.contains('active')) {
                            renderWalletPage(document.getElementById('walletPage'));
                        }
                        if (document.getElementById('profilePage').classList.contains('active')) {
                            updateProfileContent();
                        }
                    }).catch(updateError => {
                        console.error("Failed to update daily bonus timestamp:", updateError);
                        showToast('Claimed bonus but failed to record timestamp.', true);
                    });
                } else {
                    console.log("Daily bonus transaction aborted.");
                }
            });

        } catch (error) {
            console.error("Error claiming daily bonus:", error);
            showToast('An error occurred while claiming bonus.', true);
            window.open('https://toolswebsite205.blogspot.com', '_blank');
        }
    }

    /**
     * Attaches event listeners for the tabs on the My Tournaments page.
     */
    function attachMyTournamentsListeners() {
        const upcomingTab = document.getElementById('upcomingLiveTab');
        const completedTab = document.getElementById('completedTab');
        const upcomingContent = document.getElementById('upcomingLiveContent');
        const completedContent = document.getElementById('completedContent');

        if (!upcomingTab || !completedTab || !upcomingContent || !completedContent) {
            console.warn("My Tournaments tab elements not found, skipping attaching listeners.");
            return;
        }

        upcomingTab.addEventListener('click', () => { upcomingTab.className = "flex-1 py-2 text-center font-bold border-b-4 border-red-500 text-red-600"; completedTab.className = "flex-1 py-2 text-center font-bold text-gray-400 border-b-4 border-transparent"; upcomingContent.style.display = 'block'; completedContent.style.display = 'none'; });
        completedTab.addEventListener('click', () => { completedTab.className = "flex-1 py-2 text-center font-bold border-b-4 border-red-500 text-red-600"; upcomingTab.className = "flex-1 py-2 text-center font-bold text-gray-400 border-b-4 border-transparent"; completedContent.style.display = 'block'; upcomingContent.style.display = 'none'; });
    }

    /**
     * Handles joining a tournament. Deducts entry fee and adds user as participant.
     * @param {Event} event - The form submission event.
     * @param {string} tournamentId - The ID of the tournament.
     * @param {number} entryFee - The entry fee for the tournament.
     */
    async function joinTournament(event, tournamentId, entryFee) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) return showToast('Login required!', true);
        if (!currentUserData || currentUserData.locked) { 
            auth.signOut();
            const lockReason = currentUserData?.lockReason ? `Reason: ${currentUserData.lockReason}` : '';
            return showToast(`Your account is locked. Please contact support. ${lockReason}`, true);
        }
        // Tournaments entry fee is always PKR
        if ((currentUserData.wallet.PKR || 0) < entryFee) return showToast('Insufficient PKR balance!', true);

        try {
            const tournamentSnap = await db.ref(`tournaments/${tournamentId}/title`).once('value');
            const tournamentTitle = tournamentSnap.val() || 'Unknown Tournament';

            const newTransactionKey = db.ref().child('transactions').push().key;

            const updates = {
                [`/users/${user.uid}/wallet/PKR`]: (currentUserData.wallet.PKR || 0) - entryFee,
                [`/participants/${tournamentId}/${user.uid}`]: { status: 'Participated', joined_at: new Date().toISOString() },
                [`/transactions/${user.uid}/${newTransactionKey}`]: { amount: entryFee, type: 'debit', currency: 'PKR', description: `Entry: ${tournamentTitle}`, created_at: new Date().toISOString() }
            };
            await db.ref().update(updates);
            showToast('Joined successfully!');

            if (document.getElementById('myTournamentsPage').classList.contains('active')) {
                renderMyTournamentsPage(document.getElementById('myTournamentsPage'));
            }
        } catch (error) {
            console.error("Error joining tournament:", error);
            showToast('Failed to join tournament. ' + error.message, true);
        }
    }

    /**
     * Handles adding money to the user's account via deposit request.
     * @param {Event} event - The form submission event.
     */
    async function addMoney(event) {
        event.preventDefault();
        const amount = Number(document.getElementById('add-amount').value);
        const tid = document.getElementById('deposit-tid').value.trim();
        const sourceType = document.getElementById('deposit-source-type').value.trim();
        const acceptRulesCheckbox = document.getElementById('acceptDepositRules'); 

        if (amount <= 0) {
            return showToast('Amount must be positive!', true);
        }
        if (!tid) {
            return showToast('Please enter the Transaction ID (TID)!', true);
        }
        if (!sourceType) {
            return showToast('Please specify EasyPaisa or JazzCash!', true);
        }
        if (!acceptRulesCheckbox.checked) {
            return showToast('Please accept the Deposit Rules to proceed.', true);
        }

        const user = auth.currentUser;
        if (!user) return showToast('Login required!', true);
        if (!currentUserData || currentUserData.locked) { 
            auth.signOut();
            const lockReason = currentUserData?.lockReason ? `Reason: ${currentUserData.lockReason}` : '';
            return showToast(`Your account is locked. Please contact support. ${lockReason}`, true);
        }

        try {
            await db.ref(`pending_deposits/${user.uid}`).push({
                amount: amount,
                tid: tid,
                source_details: sourceType,
                status: 'pending',
                currency: 'PKR',
                created_at: new Date().toISOString(),
                user_email: currentUserData.email || user.email,
                user_username: currentUserData.username || 'N/A'
            });

            showToast('Deposit request submitted! Awaiting verification.');
            toggleModal('addMoneyModal', false);
            event.target.reset();
            acceptRulesCheckbox.checked = false;
        } catch (error) {
            console.error("Error submitting deposit request:", error);
            showToast('Failed to submit deposit request. ' + error.message, true);
        }
    }

    /**
     * Handles withdrawal requests from the user's account.
     * @param {Event} event - The form submission event.
     */
    async function withdrawMoney(event) {
        event.preventDefault();

        const amount = Number(document.getElementById('withdraw-amount').value);
        const currency = document.getElementById('withdraw-currency').value;
        const withdrawNumber = document.getElementById('withdraw-number').value.trim();
        const ownerName = document.getElementById('withdraw-owner-name').value.trim();
        const accountType = document.getElementById('withdraw-account-type').value;
        const acceptRulesCheckbox = document.getElementById('acceptWithdrawalRules'); 

        let minWithdraw = minWithdrawalAmount;
        if(currency !== 'PKR') {
            const rate = getExchangeRate('PKR', currency);
            minWithdraw = minWithdrawalAmount * rate;
        }

        if (amount < minWithdraw) {
            return showToast(`Minimum withdrawal is ${formatCurrency(minWithdraw, currency)}`, true);
        }

        if (!withdrawNumber || !ownerName || !accountType) {
            return showToast('Please fill all withdrawal details!', true);
        }
        if (!acceptRulesCheckbox.checked) {
            return showToast('Please accept the Withdrawal Rules to proceed.', true);
        }

        const user = auth.currentUser;
        if (!user) {
            return showToast('Login required!', true);
        }
        if (!currentUserData || currentUserData.locked) { 
            auth.signOut();
            const lockReason = currentUserData?.lockReason ? `Reason: ${currentUserData.lockReason}` : '';
            return showToast(`Your account is locked. Please contact support. ${lockReason}`, true);
        }
        if (amount > (currentUserData.wallet[currency] || 0)) {
            return showToast(`Insufficient ${currency} funds!`, true);
        }

        if (currency === 'PKR' && currentUserData.daily_bonus_withdrawal_condition_active) {
            const requiredReferrals = 10; 
            if ((currentUserData.referrals_earned_count || 0) < requiredReferrals) {
                showToast(`Withdrawal from PKR requires at least ${requiredReferrals} referrals for bonus funds. You have ${currentUserData.referrals_earned_count || 0}.`, true);
                return;
            }
        }

        const uid = user.uid;

        try {
            const walletCurrencyRef = db.ref(`users/${uid}/wallet/${currency}`);
            let committed = false;

            await walletCurrencyRef.transaction(currentBalance => {
                const balance = currentBalance !== null && typeof currentBalance === 'number' ? currentBalance : 0;
                if (balance >= amount) {
                    return balance - amount;
                }
                return undefined;
            }, async (error, _committed, snapshot) => {
                if (error) {
                    console.error("Withdrawal deduction failed: ", error);
                    showToast("Withdrawal failed: Could not deduct funds.", true);
                } else if (_committed) {
                    committed = true;
                    const transactionRef = db.ref(`transactions/${uid}`).push();
                    const transactionId = transactionRef.key;

                    await transactionRef.set({
                        amount: amount,
                        type: 'debit',
                        currency: currency,
                        description: `Withdrawal request for ${accountType} (${withdrawNumber})`,
                        status: 'pending',
                        created_at: new Date().toISOString()
                    });

                    const withdrawalRequestKey = db.ref("pending_withdrawals/" + uid).push().key;
                    await db.ref("pending_withdrawals/" + uid + "/" + withdrawalRequestKey).set({
                        amount: amount,
                        currency: currency,
                        status: "pending",
                        withdrawal_account: withdrawNumber,
                        withdrawal_owner_name: ownerName,
                        withdrawal_account_type: accountType,
                        created_at: new Date().toISOString(),
                        user_uid: uid,
                        user_email: currentUserData.email || user.email,
                        user_username: currentUserData.username || "N/A",
                        transaction_id_ref: transactionId
                    });

                    showToast("Withdrawal request sent! Amount deducted and awaiting admin approval.");
                    toggleModal("withdrawMoneyModal", false);
                    event.target.reset();
                    acceptRulesCheckbox.checked = false;
                } else {
                    showToast("Withdrawal aborted: Insufficient funds or another operation occurred.", true);
                }
            });
        } catch (error) {
            console.error("Error during withdrawal request:", error);
            showToast("Withdrawal failed. Please try again.", true);
        }
    }

    /**
     * Updates the user's preferred currency in Firebase.
     * @param {Event} e - The change event from the select element.
     */
    async function updateUserPreferredCurrency(e) {
        const newCurrency = e.target.value;
        if (!auth.currentUser || !currentUserData) return;

        try {
            await db.ref(`users/${auth.currentUser.uid}`).update({
                preferred_currency: newCurrency
            });
            showToast(`Preferred currency set to ${newCurrency}!`);
        } catch (error) {
            console.error("Error updating preferred currency:", error);
            showToast("Failed to update preference.", true);
        }
    }


    /**
     * Handles adding a new game submitted by a user.
     * Deducts cost from wallet based on play limit and adds game to Firebase `pending_games` node.
     * @param {Event} event - The form submission event.
     */
    async function addNewGame(event) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast('Login required to add games!', true);
            return;
        }
        if (!currentUserData || currentUserData.locked) { 
            auth.signOut();
            const lockReason = currentUserData?.lockReason ? `Reason: ${currentUserData.lockReason}` : '';
            return showToast(`Your account is locked. Please contact support. ${lockReason}`, true);
        }

        const gameTitle = document.getElementById('gameTitleInput').value.trim();
        const gameImageUrl = document.getElementById('gameImageUrlInput').value.trim();
        const gameUrl = document.getElementById('gameUrlInput').value.trim();
        const gameCategory = document.getElementById('gameCategoryInput').value.trim(); 
        const playLimit = parseInt(document.getElementById('gamePlayLimitInput').value, 10);

        if (!gameTitle || !gameImageUrl || !gameUrl || !gameCategory || isNaN(playLimit) || playLimit <= 0) { 
            showToast('All fields are required, and Play Limit must be a positive number!', true);
            return;
        }

        // NEW FEATURE: Category Restriction Validation
        try {
            const allApprovedGamesSnapshot = await db.ref('games').orderByChild('status').equalTo('approved').once('value');
            const existingCategories = new Set();
            allApprovedGamesSnapshot.forEach(childSnap => {
                const game = childSnap.val();
                if (game.category) {
                    existingCategories.add(game.category.trim().toLowerCase());
                }
            });

            // If the submitted category is not 'Uncategorized' and doesn't exist among approved categories
            if (gameCategory.toLowerCase() !== 'uncategorized' && !existingCategories.has(gameCategory.toLowerCase())) {
                const existingCategoriesArray = Array.from(existingCategories);
                const categoryList = existingCategoriesArray.length > 0 ? `(e.g., ${existingCategoriesArray.join(', ')})` : '';
                showToast(`You must use an existing game category ${categoryList}. "Uncategorized" is also an option if applicable.`, true);
                return;
            }
        } catch (error) {
            console.error("Error validating game category:", error);
            showToast('Failed to validate game category. Please try again.', true);
            return;
        }


        const gameCost = playLimit;

        if (!currentUserData || (currentUserData.wallet.PKR || 0) < gameCost) {
            showToast(`Insufficient balance. You need ${formatCurrency(gameCost, 'PKR')} to add this game.`, true);
            return;
        }

        try {
            const userWalletPKRRef = db.ref(`users/${user.uid}/wallet/PKR`);
            const pendingGameRef = db.ref('pending_games').push();
            const transactionRef = db.ref(`transactions/${user.uid}`).push();

            let committed = false;
            await userWalletPKRRef.transaction(currentBalance => {
                if (currentBalance !== null && currentBalance >= gameCost) {
                    return currentBalance - gameCost;
                }
                return undefined;
            }, async (error, _committed, snapshot) => {
                if (error) {
                    console.error("Transaction failed: ", error);
                    showToast("Failed to deduct game cost. Please try again.", true);
                } else if (_committed) {
                    committed = true;
                    await pendingGameRef.set({
                        title: gameTitle,
                        image_url: gameImageUrl,
                        game_url: gameUrl,
                        category: gameCategory, 
                        created_by: user.uid,
                        created_by_username: currentUserData.username || 'N/A',
                        created_at: new Date().toISOString(),
                        status: 'pending', // Mark as pending for admin approval
                        play_limit: playLimit,
                        play_count: 0,
                        notified_play_limit_reached: false // Flag to track if user has been notified
                    });
                    await transactionRef.set({
                        amount: gameCost,
                        type: 'debit',
                        currency: 'PKR',
                        description: `Cost for game submission (${playLimit} plays): ${gameTitle}`,
                        created_at: new Date().toISOString()
                    });

                    showToast('Game submitted successfully! It will appear on the homepage after admin approval.');
                    toggleModal('addGameModal', false);
                    event.target.reset();
                    document.getElementById('gameSubmissionCost').textContent = 'Cost: PKR 0';
                } else {
                    showToast(`Transaction aborted: Insufficient balance. You need ${formatCurrency(gameCost, 'PKR')} to add a game.`, true);
                }
            });

        } catch (error) {
            console.error("Error adding game or deducting balance:", error);
            showToast('Failed to submit game. Please try again.', true);
        }
    }

    /**
     * Handles sending a contact message from the user to admin.
     * @param {Event} event - The form submission event.
     */
    async function sendContactMessage(event) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast('Login required to send a message!', true);
            return;
        }
        if (!currentUserData || currentUserData.locked) { 
            auth.signOut();
            const lockReason = currentUserData?.lockReason ? `Reason: ${currentUserData.lockReason}` : '';
            return showToast(`Your account is locked. Please contact support. ${lockReason}`, true);
        }

        const subject = document.getElementById('contactSubject').value.trim();
        const message = document.getElementById('contactMessage').value.trim();

        if (!subject || !message) {
            showToast('Subject and Message cannot be empty!', true);
            return;
        }

        try {
            await db.ref('contact_messages').push({
                userId: user.uid,
                username: currentUserData.username || 'N/A',
                email: currentUserData.email || user.email,
                subject: subject,
                message: message,
                timestamp: new Date().toISOString(),
                status: 'pending'
            });
            showToast('Message sent successfully!');
            toggleModal('contactUsModal', false);
            event.target.reset();
        } catch (error) {
            console.error("Error sending contact message:", error);
            showToast('Failed to send message. ' + error.message, true);
        }
    }

    /**
     * Opens the currency exchange modal and populates it with current user balances.
     */
    function openExchangeCurrencyModal() {
        if (!currentUserData || !currentUserData.wallet) {
            showToast('Please login to exchange currency.', true);
            return;
        }

        const balanceInfoEl = document.getElementById('current-balance-exchange-info');
        let balancesHtml = 'Your balances: ';
        ['PKR', 'INR', 'USD'].forEach(currency => {
            const balance = currentUserData.wallet[currency] || 0;
            balancesHtml += `<span class="font-semibold mx-1">${formatCurrency(balance, currency)}</span>`;
        });
        balanceInfoEl.innerHTML = balancesHtml;

        document.getElementById('exchange-amount').value = '';
        document.getElementById('exchange-from-currency').value = currentUserData.preferred_currency || 'PKR';
        document.getElementById('exchange-to-currency').value = (currentUserData.preferred_currency === 'PKR' ? 'INR' : 'PKR');
        document.getElementById('exchange-error-message').style.display = 'none';
        document.getElementById('exchange-result-message').style.display = 'none';

        toggleModal('exchangeCurrencyModal', true);
    }

    /**
     * Calculates the exchange rate between two currencies.
     * @param {string} fromCurrency - The currency to convert from.
     * @param {string} toCurrency - The currency to convert to.
     * @returns {number} The exchange rate, or 0 if not found/invalid.
     */
    function getExchangeRate(fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return 1;
        }
        const key = `${fromCurrency}_to_${toCurrency}`;
        return exchangeRates[key] || 0;
    }

    /**
     * Handles the currency exchange process.
     * @param {Event} e - The form submission event.
     */
    async function exchangeCurrency(e) {
        e.preventDefault();
        const amountToExchange = Number(document.getElementById('exchange-amount').value);
        const fromCurrency = document.getElementById('exchange-from-currency').value;
        const toCurrency = document.getElementById('exchange-to-currency').value;
        const errorMessageEl = document.getElementById('exchange-error-message');
        const resultMessageEl = document.getElementById('exchange-result-message');

        errorMessageEl.style.display = 'none';
        resultMessageEl.style.display = 'none';

        if (!amountToExchange || amountToExchange <= 0) {
            errorMessageEl.textContent = 'Please enter a valid amount to exchange.';
            errorMessageEl.style.display = 'block';
            return;
        }

        if (fromCurrency === toCurrency) {
            errorMessageEl.textContent = 'Cannot exchange to the same currency.';
            errorMessageEl.style.display = 'block';
            return;
        }

        if (!auth.currentUser || !currentUserData || !currentUserData.wallet) {
            errorMessageEl.textContent = 'User data not loaded. Please re-login.';
            errorMessageEl.style.display = 'block';
            return;
        }

        const availableAmount = currentUserData.wallet[fromCurrency] || 0;
        if (availableAmount < amountToExchange) {
            errorMessageEl.textContent = `Insufficient ${fromCurrency} balance. You have ${formatCurrency(availableAmount, fromCurrency)}.`;
            errorMessageEl.style.display = 'block';
            return;
        }

        const rate = getExchangeRate(fromCurrency, toCurrency);
        if (rate === 0) {
            errorMessageEl.textContent = `Exchange rate for ${fromCurrency} to ${toCurrency} not found.`;
            errorMessageEl.style.display = 'block';
            return;
        }

        const convertedAmount = amountToExchange * rate;
        const userId = auth.currentUser.uid;
        let shouldChangePreferredCurrency = false;

        try {
            await db.ref(`users/${userId}/wallet`).transaction(currentWallet => {
                if (currentWallet) {
                    const fromBalance = currentWallet[fromCurrency] || 0;
                    if (fromBalance >= amountToExchange) {
                        currentWallet[fromCurrency] = fromBalance - amountToExchange;
                        currentWallet[toCurrency] = (currentWallet[toCurrency] || 0) + convertedAmount;
                        
                        if (currentUserData.preferred_currency === fromCurrency && currentWallet[fromCurrency] < 0.01) {
                             shouldChangePreferredCurrency = true;
                        }
                        return currentWallet;
                    }
                }
                return undefined;
            }, async (error, committed, snapshot) => {
                if (error) {
                    console.error('Currency exchange transaction failed:', error);
                    errorMessageEl.textContent = `Exchange failed: ${error.message}`;
                    errorMessageEl.style.display = 'block';
                } else if (committed) {
                    if (shouldChangePreferredCurrency) {
                        await db.ref(`users/${userId}`).update({ preferred_currency: toCurrency });
                    }

                    await db.ref(`transactions/${userId}`).push({
                        amount: amountToExchange,
                        type: 'exchange',
                        currency: fromCurrency,
                        description: `Exchanged ${formatCurrency(amountToExchange, fromCurrency)} to ${formatCurrency(convertedAmount, toCurrency)}`,
                        exchange_from_currency: fromCurrency,
                        exchange_to_currency: toCurrency,
                        exchanged_amount: convertedAmount,
                        created_at: new Date().toISOString()
                    });
                    
                    resultMessageEl.textContent = `Successfully exchanged ${formatCurrency(amountToExchange, fromCurrency)} for ${formatCurrency(convertedAmount, toCurrency)}!`;
                    resultMessageEl.style.display = 'block';
                    showToast(resultMessageEl.textContent);
                    
                    setTimeout(() => openExchangeCurrencyModal(), 100); 
                } else {
                    errorMessageEl.textContent = 'Exchange aborted: Insufficient funds or another operation occurred.';
                    errorMessageEl.style.display = 'block';
                }
            });
        } catch (error) {
            console.error("Error during exchange:", error);
            errorMessageEl.textContent = `An unexpected error occurred: ${error.message}`;
            errorMessageEl.style.display = 'block';
        }
    }

    /**
     * Toggles the visibility of the main profile view vs. policy content area.
     */
    function showMainProfileView() {
        document.getElementById('mainProfileView').style.display = 'block';
        document.getElementById('policyContentArea').style.display = 'none';
        document.getElementById('policy-content-display').style.display = 'none';
        document.getElementById('mySupportMessagesSection').style.display = 'none';
    }

    /**
     * Displays a specific policy section or the contact messages.
     * @param {string} sectionKey - The key for the policy (e.g., 'privacy_policy') or 'my_support_messages'.
     */
    async function showPolicySection(sectionKey) {
        document.getElementById('mainProfileView').style.display = 'none';
        document.getElementById('policyContentArea').style.display = 'block';
        document.getElementById('mySupportMessagesSection').style.display = 'none'; // Hide support messages by default

        const policyDisplay = document.getElementById('policy-content-display');
        const policyTitle = document.getElementById('policy-display-title');
        const policyBody = document.getElementById('policy-display-body');

        if (!policyDisplay || !policyTitle || !policyBody) {
            console.warn("Policy display elements not found.");
            showToast("Error: Policy display elements missing.", true);
            return;
        }

        policyDisplay.style.display = 'block';
        policyTitle.textContent = 'Loading...';
        policyBody.innerHTML = '<p class="text-center text-gray-400 italic">Loading policy content...</p>';

        try {
            // UPDATED: Corrected Firebase path to match admin panel's saving location
            const policySnap = await db.ref(`app_content/${sectionKey}`).once('value'); 
            const policyData = policySnap.val();

            if (policyData) {
                // UPDATED: Corrected field names to match admin panel's saving structure
                policyTitle.textContent = policyData.displayTitle || sectionKey.replace(/_/g, ' ').toUpperCase();
                policyBody.innerHTML = policyData.body || '<p>Content not available.</p>';
            } else {
                policyTitle.textContent = 'Content Not Found';
                policyBody.innerHTML = '<p>The requested policy content could not be loaded.</p>';
            }
        } catch (error) {
            console.error("Error loading policy:", error);
            policyTitle.textContent = 'Error';
            policyBody.innerHTML = '<p class="text-red-500">Failed to load policy content due to an error.</p>';
        }
    }

    /**
     * Displays the user's support messages.
     */
    async function showMySupportMessages() {
        if (!auth.currentUser) {
            showToast('Login required to view support messages!', true);
            return;
        }
        document.getElementById('mainProfileView').style.display = 'none';
        document.getElementById('policyContentArea').style.display = 'block';
        document.getElementById('policy-content-display').style.display = 'none'; // Hide general policy display
        document.getElementById('mySupportMessagesSection').style.display = 'block';

        const listEl = document.getElementById('user-contact-messages-list');
        if (!listEl) { console.warn("user-contact-messages-list not found."); return; }
        listEl.innerHTML = '<p class="text-center text-gray-400 italic">Loading your messages...</p>';

        const userId = auth.currentUser.uid;
        try {
            const messagesSnap = await db.ref('contact_messages').orderByChild('userId').equalTo(userId).once('value');
            const messagesData = messagesSnap.val();

            if (!messagesData) {
                listEl.innerHTML = '<p class="text-center text-gray-500 italic">You have not sent any support messages yet.</p>';
                return;
            }

            const messagesArray = [];
            for (const id in messagesData) {
                messagesArray.push({ id, ...messagesData[id] });
            }
            messagesArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            listEl.innerHTML = messagesArray.map(msg => {
                const statusColor = msg.status === 'resolved' ? 'text-green-600' : (msg.status === 'replied' ? 'text-blue-600' : 'text-orange-500');
                return `
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div class="flex justify-between items-center mb-1">
                            <p class="font-semibold text-gray-800">${escapeJsStringForHtmlAttribute(msg.subject)}</p>
                            <span class="text-xs font-bold ${statusColor}">${escapeJsStringForHtmlAttribute(msg.status)}</span>
                        </div>
                        <p class="text-sm text-gray-600 mt-1">${escapeJsStringForHtmlAttribute(msg.message)}</p>
                        ${msg.adminReply ? `<p class="text-sm text-blue-700 mt-2 font-semibold">Admin Reply: ${escapeJsStringForHtmlAttribute(msg.adminReply)}</p>` : ''}
                        <p class="text-xs text-gray-500 mt-2">${new Date(msg.timestamp).toLocaleString()}</p>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error("Error loading support messages:", error);
            listEl.innerHTML = '<p class="text-center text-red-500 italic">Error loading your support messages.</p>';
        }
    }


    /**
     * Logs the current user out of the application.
     */
    function logout() {
        auth.signOut();
    }

    /**
     * Sends a password reset email to the current user.
     */
    function changePassword() {
        const user = auth.currentUser;
        if (user && user.email) {
            auth.sendPasswordResetEmail(user.email)
                .then(() => showToast(`Password reset link sent to ${user.email}.`))
                .catch(err => showToast(err.message, true));
        } else {
            showToast("No active user or email found.", true);
        }
    }

    /**
     * Initializes the application once the DOM is fully loaded.
     */
    document.addEventListener('DOMContentLoaded', async () => {

        // Attach event listeners for forms and buttons
        attachLoginListeners();
        // The original form submit listeners
        document.getElementById('addMoneyForm')?.addEventListener('submit', addMoney);
        document.getElementById('withdrawMoneyForm')?.addEventListener('submit', withdrawMoney);
        document.getElementById('addGameForm')?.addEventListener('submit', addNewGame);
        document.getElementById('contactUsForm')?.addEventListener('submit', sendContactMessage);
        document.getElementById('exchangeCurrencyForm')?.addEventListener('submit', exchangeCurrency);

        const gamePlayLimitInput = document.getElementById('gamePlayLimitInput');
        const gameSubmissionCostDisplay = document.getElementById('gameSubmissionCost');

        if (gamePlayLimitInput && gameSubmissionCostDisplay) {
            gamePlayLimitInput.addEventListener('input', () => {
                const playLimit = parseInt(gamePlayLimitInput.value, 10);
                if (!isNaN(playLimit) && playLimit > 0) {
                    gameSubmissionCostDisplay.textContent = `Cost: ${formatCurrency(playLimit, 'PKR')}`;
                } else {
                    gameSubmissionCostDisplay.textContent = 'Cost: PKR 0';
                }
            });
        }

        navigateTo('homePage');
    });

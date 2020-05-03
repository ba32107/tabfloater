function setButtonStates() {
    chrome.runtime.getBackgroundPage(function (backgroundPage) {
        backgroundPage.tryGetFloatingTab(function (floatingTab) {
            const floatingTabAlreadyExists = floatingTab != undefined;

            if (floatingTabAlreadyExists) {
                floatTabButton.disabled = true;
                unfloatTabButton.disabled = false;
            } else {
                unfloatTabButton.disabled = true;
                backgroundPage.canFloatCurrentTab(function (canFloat) {
                    floatTabButton.disabled = !canFloat;
                });
            }
        });
    });
}

function setCompanionStatusIndicator() {
    chrome.runtime.getBackgroundPage(function (backgroundPage) {
        backgroundPage.getCompanionStatus(function (status) {
            companionStatusConnecting.classList.add("is-hidden");

            if (status == "connected") {
                companionStatusConnected.classList.remove("is-hidden");
            } else if (status == "inactive") {
                companionStatusInactive.classList.remove("is-hidden");
            } else if (status == "error") {
                companionStatusError.classList.remove("is-hidden");
            } else {
                companionStatusUnavailable.classList.remove("is-hidden");
            }
        });
    });
}

window.onload = function () {
    setButtonStates();
    setCompanionStatusIndicator();
}

floatTabButton.onclick = function () {
    window.close();

    chrome.runtime.getBackgroundPage(function (backgroundPage) {
        backgroundPage.floatTab();
    });
};

unfloatTabButton.onclick = function () {
    window.close();
    chrome.runtime.getBackgroundPage(function (backgroundPage) {
        backgroundPage.unfloatTab();
    });
};

optionsButton.onclick = function () {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('options.html'));
    }
}

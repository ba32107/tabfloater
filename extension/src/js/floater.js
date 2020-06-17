/*
 * Copyright 2020 Balazs Gyurak
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as companion from "./companion.js";
import * as positioner from "./positioning/positioner.js";
import * as notifier from "./notifier.js";
import { getLoggerAsync } from "./logger.js";
import { runningOnFirefoxAsync } from "./main.js";

export async function tryGetFloatingTabAsync() {
    const data = await browser.storage.local.get(["floatingTabProperties"]);
    const tabProps = data.floatingTabProperties;

    const result = {
        floatingTab: undefined,
        floatingTabProperties: undefined
    };

    if (tabProps) {
        try {
            const floatingTab = await browser.tabs.get(tabProps.tabId);
            result.floatingTab = floatingTab;
            result.tabProps = tabProps;
        } catch (error) {
            await clearFloatingTabAsync();
        }
    }

    return result;
}

export async function floatTabAsync(logger) {
    const { floatingTab } = await tryGetFloatingTabAsync();

    if (!floatingTab) {
        await floatingStartedAsync();

        try {
            const allActiveTabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
            const currentTab = allActiveTabs[0];

            if (currentTab) {
                const tabProps = {
                    tabId: currentTab.id,
                    parentWindowId: currentTab.windowId,
                    originalIndex: currentTab.index,
                    position: await positioner.getStartingPositionAsync()
                };

                logger.info(`Will float current tab. TabProps: ${JSON.stringify(tabProps)}`);

                const succeedingActiveTab = await getSucceedingActiveTabAsync();
                const coordinates = await positioner.calculateCoordinatesAsync(logger);
                const newWindow = await browser.windows.create({
                    "tabId": currentTab.id,
                    "type": "popup",
                    "top": coordinates.top,
                    "left": coordinates.left,
                    "width": coordinates.width,
                    "height": coordinates.height,
                });

                if (await runningOnFirefoxAsync()) {
                    // On Firefox, "popup" or "panel" windows do not respect the
                    // coordinates when created, so we need to set them explicitly.
                    // See https://bugzilla.mozilla.org/show_bug.cgi?id=1271047

                    await browser.windows.update(newWindow.id, {
                        "top": coordinates.top,
                        "left": coordinates.left,
                        "width": coordinates.width,
                        "height": coordinates.height,
                    });
                }

                const parentWindowTitle = succeedingActiveTab.title;
                const result = await companion.sendMakeDialogRequestAsync(currentTab.title, parentWindowTitle, logger);
                await setFloatingTabAsync(tabProps);

                if (result.success) {
                    notifier.setFloatingSuccessIndicator();
                } else {
                    if (result.reason === "error") {
                        notifier.setErrorIndicator("The companion returned an error!");
                    } else if (result.reason === "unavailable") {
                        notifier.setErrorIndicator("Unable to contact companion!");
                    }
                }
            } else {
                logger.info("Tried to float current tab, but no active tab found - is Chrome DevTools in focus?");
            }
        } finally {
            await clearFloatingProgressAsync();
        }
    }
}

export async function unfloatTabAsync() {
    const { floatingTab, tabProps } = await tryGetFloatingTabAsync();

    if (floatingTab) {
        await browser.tabs.move(tabProps.tabId, { windowId: tabProps.parentWindowId, index: tabProps.originalIndex });
        await clearFloatingTabAsync();
    }
}

export async function repositionFloatingTabIfExistsAsync(logger) {
    const { floatingTab } = await tryGetFloatingTabAsync();

    if (floatingTab) {
        const coordinates = await positioner.calculateCoordinatesAsync(logger);
        await browser.windows.update(floatingTab.windowId, coordinates);
    }
}

export async function canFloatCurrentTabAsync() {
    const floatingProgress = await browser.storage.local.get(["floatingInProgress"]);
    if (floatingProgress.floatingInProgress) {
        return false;
    }

    const parentWindow = await browser.windows.getLastFocused({ populate: true });
    return parentWindow.tabs.length > 1;
}

export async function setFloatingTabAsync(tabProps) {
    await browser.storage.local.set({ floatingTabProperties: tabProps });
}

export async function clearFloatingTabAsync() {
    const logger = await getLoggerAsync();
    await browser.storage.local.remove(["floatingTabProperties"]);

    const companionInfo = await companion.getCompanionInfoAsync(logger);
    if (companionInfo.isOutdated) {
        notifier.setUpdateAvailableIndicator();
    } else {
        notifier.clearIndicator();
    }
}

export async function clearFloatingProgressAsync() {
    await browser.storage.local.remove(["floatingInProgress"]);
}

async function floatingStartedAsync() {
    await browser.storage.local.set({ floatingInProgress: true });
}

/**
 * Returns the tab that is going to be active after the float action happens.
 * This is always the tab right to the active tab, except when the active
 * tab is the last one, in which case it's the one to the left.
 */
async function getSucceedingActiveTabAsync() {
    const allTabsOnCurrentWindow = await browser.tabs.query({ lastFocusedWindow: true });
    allTabsOnCurrentWindow.sort((tab1, tab2) => tab1.index < tab2.index);

    const currentTab = allTabsOnCurrentWindow.find(tab => tab.active);
    const currentTabIsLast = currentTab.index === allTabsOnCurrentWindow.length - 1;

    return currentTabIsLast
        ? allTabsOnCurrentWindow[currentTab.index - 1]
        : allTabsOnCurrentWindow[currentTab.index + 1];
}

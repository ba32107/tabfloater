/*
 * Copyright 2021 Balazs Gyurak
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

const LifeCycleCategory = "lifeCycle";
const UsageCategory = "usage";
const OptionsCategory = "options";

let analyticsImpl = undefined;

export function setAnalyticsImpl(analytics) {
    analyticsImpl = analytics;
}

export async function reportInstalledEventAsync(os, browser) {
    await sendEventAsync(LifeCycleCategory, "installed", `${os}:${browser}`);
}

export async function reportFloatEventAsync() {
    await sendEventAsync(UsageCategory, "float");
}

export async function reportFloatErrorEventAsync(errorReason) {
    await sendEventAsync(UsageCategory, "floatError", errorReason);
}

export async function reportUnfloatEventAsync() {
    await sendEventAsync(UsageCategory, "unfloat");
}

export async function reportTabMoveEventAsync() {
    await sendEventAsync(UsageCategory, "tabMoved");
}

export async function reportOptionsEventAsync(data) {
    await sendEventAsync(OptionsCategory, "optionsClosed", undefined, data);
}

async function sendEventAsync(category, action, label, data) {
    if (analyticsImpl) {
        await analyticsImpl.sendEventAsync(category, action, label, data);
    }
}

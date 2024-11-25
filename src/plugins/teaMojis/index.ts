/*
* Vencord, a Discord client mod
* Copyright (c) 2024 Vendicated and contributors*
* SPDX-License-Identifier: GPL-3.0-or-later
*/

import { findOption, OptionalMessageOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "TeaMojis",
    description: "Adds even more Kaomoji to discord! ٩(ˊᗜˋ*)",
    authors: [Devs.disuko, Devs.HoneyTeaaa],
    commands: [
        { name: "cad", description: "ฅ^•ﻌ•^ฅ" },
        { name: "dance", description: "٩(ˊᗜˋ*)و" },
        { name: "catblush", description: "( ˶ˆ꒳ˆ˵ )" },
        { name: "snail", description: "(๑•͈ᴗ•͈)" },
        { name: "cuteshrug", description: "\"૮₍  ˶•⤙•˶ ₎ა\"" },
        { name: "birthday", description: "( o˘◡˘o) ┌iii┐" },
        { name: "brotherew", description: "(·•᷄‎ࡇ•᷅ )" },
        { name: "puppycat", description: "( ｡ •̀ ᴖ •́ ｡)"},
        { name: "castrate", description: "( ＾▽＾)っ✂╰⋃╯"},

    ].map(data => ({
        ...data,
        options: [OptionalMessageOption],
        execute: opts => ({
            content: findOption(opts, "message", "") + " " + data.description
        })
    }))
});



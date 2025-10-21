import { findOption, OptionalMessageOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UploadHandler, UploadManager, DraftType } from "@webpack/common";

// Load image utility function from petpet by Ven
function loadImage(source: File | string) {
    const isFile = source instanceof File;
    const url = isFile ? URL.createObjectURL(source) : source;

    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (isFile) URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = (event, _source, _lineno, _colno, err) => reject(err || event);
        img.crossOrigin = "Anonymous";
        img.src = url;
    });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    let lines: string[] = [];

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > maxWidth && i > 0) {
            lines.push(line);
            line = words[i] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    lines.forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
    });
}

export default definePlugin({
    name: "parnets",
    description: "Create parnets memes for when your friends mispell words.",
    authors: [Devs.disuko],
    commands: [
        {
            name: "parnets",
            description: "Overlay text on a blank canvas.",
            options: [
                {
                    name: "message_contents",
                    description: "Message to be said by Batman.",
                    type: 3, // STRING
                    required: true
                },
                {
                    name: "misspelled_word",
                    description: "Mispelled word to be said by the Ninja Turtles.",
                    type: 3, // STRING
                    required: true
                },
                {
                    name: "correct_word",
                    description: "The correct spelling of the mispelled word, said by Batman.",
                    type: 3, // STRING
                    required: true
                }
            ],
            execute: async (opts, cmdCtx) => {
                const messageContents = findOption(opts, "message_contents", "");
                const misspelledWord = findOption(opts, "misspelled_word", "");
                const correctWord = findOption(opts, "correct_word", "");

                const canvas = document.createElement("canvas");
                canvas.width = 1170;
                canvas.height = 1198;
                const ctx = canvas.getContext("2d");

                UploadManager.clearAll(cmdCtx.channel.id, DraftType.SlashCommand);
                if (ctx) {
                    const backgroundImage = await loadImage("https://raw.githubusercontent.com/disukomusic/Disukord/e72e94ae28eea7e835ce5427e98b918acdf55dea/src/plugins/parnets/parnets.png");

                    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    ctx.font = "48px 'Comic Sans MS'";
                    const messageX = 465;
                    const messageY = 55;
                    const maxMessageWidth = 510;
                    const lineHeight = 48;
                    wrapText(ctx, messageContents, messageX, messageY, maxMessageWidth, lineHeight);

                    ctx.font = "64px 'Comic Sans MS'";
                    ctx.fillText(correctWord, 465, 268);

                    ctx.font = "64x 'Comic Sans MS'";
                    ctx.fillText(misspelledWord, 50, 325);
                    ctx.fillText(misspelledWord, 360, 1024);
                    ctx.fillText(misspelledWord, 600, 760);

                    canvas.toBlob((blob: Blob | null) => {
                        if (blob) {
                            const file = new File([blob], "text_overlay.png", { type: "image/png" });

                            setTimeout(() => UploadHandler.promptToUpload([file], cmdCtx.channel, DraftType.ChannelMessage), 10);
                        } else {
                            console.error("Failed to create blob from canvas");
                        }
                    }, "image/png");
                } else {
                    console.error("Failed to get 2D context from canvas");
                }
            }
        }
    ]
});

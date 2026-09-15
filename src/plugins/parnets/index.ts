import { findOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UploadManager, DraftType, RestAPI, FluxDispatcher, MessageStore, UserStore } from "@webpack/common";
import { findStore, findByPropsLazy } from "@webpack";

const { uniqueId } = findByPropsLazy("uniqueId");

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
                    name: "misspelled_word",
                    description: "Misspelled word to be said by the Ninja Turtles.",
                    type: 3, // STRING
                    required: true
                },
                {
                    name: "correct_word",
                    description: "The correct spelling of the misspelled word, said by Batman.",
                    type: 3, // STRING
                    required: true
                },
                {
                    name: "message_contents",
                    description: "Message said by Batman (leave empty to use replied-to message).",
                    type: 3, // STRING
                    required: false
                }
            ],
            execute: async (opts, cmdCtx) => {
                let messageContents = findOption(opts, "message_contents", "");
                const misspelledWord = findOption(opts, "misspelled_word", "");
                const correctWord = findOption(opts, "correct_word", "");

                const PendingReplyStore = findStore("PendingReplyStore");
                const pendingReply = PendingReplyStore?.getPendingReply(cmdCtx.channel.id);

                // Check for a replied message if no custom message was typed
                if (!messageContents) {
                    if (pendingReply?.message) {
                        messageContents = pendingReply.message.content;
                    } else {
                        return { content: "❌ You must either provide `message_contents` or reply to a message!" };
                    }
                }

                // Immediately clear out the slash command UI text
                UploadManager.clearAll(cmdCtx.channel.id, DraftType.SlashCommand);
                UploadManager.clearAll(cmdCtx.channel.id, DraftType.ChannelMessage);

                const canvas = document.createElement("canvas");
                canvas.width = 1170;
                canvas.height = 1198;
                const ctx = canvas.getContext("2d");

                if (ctx) {
                    const backgroundImage = await loadImage("https://raw.githubusercontent.com/disukomusic/Disukord/e72e94ae28eea7e835ce5427e98b918acdf55dea/src/plugins/parnets/parnets.png");

                    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    ctx.font = "48px 'Comic Sans MS'";
                    wrapText(ctx, messageContents, 465, 55, 510, 48);

                    ctx.font = "64px 'Comic Sans MS'";
                    ctx.fillText(correctWord, 465, 268);

                    ctx.font = "64px 'Comic Sans MS'";
                    ctx.fillText(misspelledWord, 50, 325);
                    ctx.fillText(misspelledWord, 360, 1024);
                    ctx.fillText(misspelledWord, 600, 760);

                    canvas.toBlob(async (blob: Blob | null) => {
                        if (blob) {
                            const file = new File([blob], "parnets.png", { type: "image/png" });

                            try {
                                // request an upload URL from Discord's API
                                const { body: { attachments } } = await RestAPI.post({
                                    url: `/channels/${cmdCtx.channel.id}/attachments`,
                                    body: {
                                        files: [{
                                            filename: file.name,
                                            file_size: file.size,
                                            id: uniqueId?.() ?? "1",
                                            is_clip: false
                                        }]
                                    }
                                }) as any;

                                // upload the raw image data to the URL Discord provided
                                await fetch(attachments[0].upload_url, {
                                    method: "PUT",
                                    body: file
                                });

                                // Send final message via API (bypassing the chat box entirely)
                                await RestAPI.post({
                                    url: `/channels/${cmdCtx.channel.id}/messages`,
                                    body: {
                                        content: "",
                                        attachments: [{
                                            id: attachments[0].id,
                                            uploaded_filename: attachments[0].upload_filename,
                                            filename: file.name
                                        }],
                                        message_reference: pendingReply?.message ? {
                                            guild_id: cmdCtx.channel.guild_id,
                                            channel_id: cmdCtx.channel.id,
                                            message_id: pendingReply.message.id
                                        } : undefined
                                    }
                                });

                                // Clear the "Replying to..." UI bar safely via Dispatcher
                                FluxDispatcher.dispatch({
                                    type: "DELETE_PENDING_REPLY",
                                    channelId: cmdCtx.channel.id
                                });

                                // delete the local command invocation message
                                setTimeout(() => {
                                    const channelMessages = MessageStore.getMessages(cmdCtx.channel.id);
                                    if (channelMessages && channelMessages.toArray) {
                                        const messages = channelMessages.toArray();
                                        const currentUserId = UserStore.getCurrentUser().id;

                                        // Find the command message we just sent in the local cache
                                        const cmdMsg = [...messages].reverse().find(m => m.author.id === currentUserId && m.content.includes("parnets"));

                                        if (cmdMsg) {
                                            FluxDispatcher.dispatch({
                                                type: "MESSAGE_DELETE",
                                                channelId: cmdCtx.channel.id,
                                                id: cmdMsg.id
                                            });
                                        }
                                    }
                                }, 250);

                            } catch (e) {
                                console.error("API Upload failed:", e);
                            }
                        } else {
                            console.error("Failed to create blob from canvas");
                        }
                    }, "image/png");
                }
            }
        }
    ]
});

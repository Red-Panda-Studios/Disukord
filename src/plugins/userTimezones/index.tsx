import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React, Menu, Tooltip } from "@webpack/common";
import { BaseText } from "@components/BaseText";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { findCssClassesLazy } from "@webpack";

// 1. Define Settings
const settings = definePluginSettings({
    userTimezones: {
        type: OptionType.STRING,
        default: "{}",
        description: 'JSON format: {"USER_ID": "America/New_York"}',
        name: "Timezone Map (Advanced)",
    },
    showSeconds: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Display seconds in the timestamp",
        name: "Show Seconds",
    },
    use24Hour: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Use 24-hour format (e.g. 14:30) instead of AM/PM",
        name: "24-Hour Time",
    }
});

const COMMON_TIMEZONES = [
    "America/Los_Angeles", "America/Chicago", "America/New_York",
    "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"
];

const TimestampClasses = findCssClassesLazy("timestampInline", "timestamp");

// 2. Context Menu to Set Timezones
const UserContext: NavContextMenuPatchCallback = (children, props) => {
    const user = props?.user;
    if (!user) return;

    const setTz = (tz: string | null) => {
        let tzMap: Record<string, string> = {};
        try { tzMap = JSON.parse(settings.store.userTimezones); } catch (e) { }

        if (tz) tzMap[user.id] = tz;
        else delete tzMap[user.id];

        settings.store.userTimezones = JSON.stringify(tzMap);
    };

    let currentTz: string | undefined;
    try { currentTz = JSON.parse(settings.store.userTimezones)[user.id]; } catch {}

    children.push(
        <Menu.MenuGroup key="vc-user-timezone-group">
            <Menu.MenuItem id="vc-user-timezone" label="Set Timezone">
                <Menu.MenuItem
                    id="vc-tz-clear"
                    label="Clear Timezone"
                    color="danger"
                    disabled={!currentTz}
                    action={() => setTz(null)}
                />
                <Menu.MenuSeparator />
                {COMMON_TIMEZONES.map(tz => (
                    <Menu.MenuItem
                        id={`vc-tz-${tz}`}
                        key={tz}
                        label={tz.replace("_", " ")}
                        type="radio"
                        checked={currentTz === tz}
                        action={() => setTz(tz)}
                    />
                ))}
            </Menu.MenuItem>
        </Menu.MenuGroup>
    );
};

// 3. React Component (Wrapped in ErrorBoundary)
function TimezoneComponent({ userId, isChat }: { userId: string, isChat?: boolean }) {
    const [time, setTime] = React.useState<string | null>(null);

    React.useEffect(() => {
        let tzMap: Record<string, string>;
        try { tzMap = JSON.parse(settings.store.userTimezones); } catch (e) { tzMap = {}; }

        const tz = tzMap[userId];
        if (!tz) {
            setTime(null);
            return;
        }

        const updateTime = () => {
            try {
                const formatter = new Intl.DateTimeFormat("en-US", {
                    timeZone: tz,
                    hour: "numeric",
                    minute: "2-digit",
                    second: settings.store.showSeconds ? "2-digit" : undefined,
                    hour12: !settings.store.use24Hour,
                });
                setTime(formatter.format(new Date()));
            } catch (error) {
                setTime("Invalid TZ");
            }
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [userId, settings.store.userTimezones, settings.store.showSeconds, settings.store.use24Hour]);

    if (!time) return null;

    // Use native Discord timestamp text for chat messages to prevent overlap
    if (isChat) {
        return (
            <Tooltip text="User's Local Time">
                {tooltipProps => (
                    <span
                        {...tooltipProps}
                        className={`${TimestampClasses.timestampInline} ${TimestampClasses.timestamp}`}
                        style={{ marginLeft: "4px" }}
                    >
                        • {time}
                    </span>
                )}
            </Tooltip>
        );
    }

    // Keep the tag styling for the member list
    return (
        <Tooltip text="User's Local Time">
            {tooltipProps => (
                <BaseText
                    {...tooltipProps}
                    tag="span"
                    size="xs"
                    weight="medium"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        marginLeft: "0.25rem",
                        padding: "0 4px",
                        borderRadius: "4px",
                        backgroundColor: "var(--background-secondary-alt)",
                        color: "var(--text-muted)",
                        lineHeight: "1.375rem"
                    }}
                >
                    {time}
                </BaseText>
            )}
        </Tooltip>
    );
}

const TimezoneTag = ErrorBoundary.wrap(TimezoneComponent);

// 4. Register Plugin & Native Decorators
export default definePlugin({
    name: "UserTimezones",
    description: "Displays a user's local time next to their username in messages and member lists.",
    authors: [{ name: "YourName", id: 123456789012345678n }], // Replace with your ID!
    tags: ["Chat"],
    settings,
    contextMenus: {
        "user-context": UserContext
    },

    // Injects directly into chat messages!
    renderMessageDecoration: (props: any) => {
        const id = props?.message?.author?.id;
        if (!id) return null;
        return <TimezoneTag userId={id} isChat={true} />;
    },

    // Injects directly into the Server Member list and DM lists!
    renderMemberListDecorator: (props: any) => {
        const id = props?.user?.id || props?.id;
        if (!id) return null;
        return <TimezoneTag userId={id} isChat={false} />;
    }
});

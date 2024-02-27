"use client";
import React from "react";

const colorSchemes = ["light", "dark"];
const MEDIA = "(prefers-color-scheme: dark)";
const isServer = typeof window === "undefined";
const ThemeContext = React.createContext();
const defaultContext = { setTheme: (_) => {}, themes: [] };

export const useTheme = () => React.useContext(ThemeContext) ?? defaultContext;

export default function ThemeProvider(props) {
    const context = React.useContext(ThemeContext);
    console.log("\n== theme provider ==\n");
    // Ignore nested context providers, just passthrough children
    if (context) return <Fragment>{props.children}</Fragment>;
    return <Theme {...props} />;
}

const defaultThemes = ["light", "dark"];

function Theme({
    forcedTheme,
    disableTransitionOnChange = false,
    enableSystem = true,
    enableColorScheme = true,
    storageKey = "theme",
    themes = defaultThemes,
    defaultTheme = enableSystem ? "system" : "light",
    attribute = "data-theme",
    value,
    children,
    nonce,
}) {
    console.log("\n== theme ==\n");
    const [theme, setThemeState] = React.useState(() => getTheme(storageKey, defaultTheme));
    const [resolvedTheme, setResolvedTheme] = React.useState(() => getTheme(storageKey));
    const attrs = !value ? themes : Object.values(value);

    // function
    const applyTheme = React.useCallback(function (theme) {
        console.log("\n== applyTheme ==\n");
        let resolved = theme;
        if (!resolved) return;

        // If theme is system, resolve it before setting theme
        if (theme === "system" && enableSystem) {
            // enableSystem is a prop
            resolved = getSystemTheme(); // see helpers at bottom
        }

        const name = value ? value[resolved] : resolved;

        const rootHTML = document.documentElement;

        if (attribute === "class") {
            rootHTML.classList.remove(...attrs);

            if (name) rootHTML.classList.add(name);
        } else {
            if (name) {
                rootHTML.setAttribute(attribute, name);
            } else {
                rootHTML.removeAttribute(attribute);
            }
        }

        if (enableColorScheme) {
            const fallback = colorSchemes.includes(defaultTheme) ? defaultTheme : null;
            const colorScheme = colorSchemes.includes(resolved) ? resolved : fallback;
            // @ts-ignore
            rootHTML.style.colorScheme = colorScheme;
        }

        const enable = disableTransitionOnChange ? disableAnimation() : null;
        enable?.();
    }, []);

    // function
    const setTheme = React.useCallback(
        function (theme) {
            console.log("\n== setTheme ==\n");
            const newTheme = typeof theme === "function" ? theme(theme) : theme;
            setThemeState(newTheme);

            // Save to storage
            try {
                localStorage.setItem(storageKey, newTheme);
            } catch (e) {
                // Unsupported
            }
        },
        [forcedTheme],
    );

    // function
    const handleMediaQuery = React.useCallback(
        function (e) {
            console.log("\n== handleMediaQuery ==\n");
            const resolved = getSystemTheme(e); // getSystemTheme - see helpers
            setResolvedTheme(resolved);

            if (theme === "system" && enableSystem && !forcedTheme) {
                applyTheme("system");
            }
        },
        [theme, forcedTheme],
    );

    // Always listen to System preference
    React.useEffect(() => {
        console.log("\n== UE_1 ==\n");
        const media = window.matchMedia(MEDIA);

        // Intentionally use deprecated listener methods to support iOS & old browsers
        media.addListener(handleMediaQuery);
        handleMediaQuery(media);

        return () => media.removeListener(handleMediaQuery);
    }, [handleMediaQuery]);

    // localStorage event handling
    React.useEffect(() => {
        console.log("\n== UE_2 ==\n");
        const handleStorage = function (e) {
            console.log("\n== handleStorage ==\n");
            if (e.key !== storageKey) {
                return;
            }

            // If default theme set, use it if localstorage === null (happens on local storage manual deletion)
            const theme = e.newValue || defaultTheme;
            setTheme(theme);
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [setTheme]);

    // Whenever theme or forcedTheme changes, apply it
    React.useEffect(() => {
        console.log("\n== UE_3 ==\n");
        applyTheme(forcedTheme ?? theme);
    }, [forcedTheme, theme]);

    const providerValue = React.useMemo(
        () => ({
            theme,
            setTheme,
            forcedTheme,
            resolvedTheme: theme === "system" ? resolvedTheme : theme,
            themes: enableSystem ? [...themes, "system"] : themes,
            systemTheme: enableSystem ? resolvedTheme : undefined,
        }),
        [theme, setTheme, forcedTheme, resolvedTheme, enableSystem, themes],
    );

    return (
        <ThemeContext.Provider value={providerValue}>
            <ThemeScript
                {...{
                    forcedTheme,
                    disableTransitionOnChange,
                    enableSystem,
                    enableColorScheme,
                    storageKey,
                    themes,
                    defaultTheme,
                    attribute,
                    value,
                    children,
                    attrs,
                    nonce,
                }}
            />
            {children}
        </ThemeContext.Provider>
    );
}

const ThemeScript = React.memo(
    function ({
        forcedTheme,
        storageKey,
        attribute,
        enableSystem,
        enableColorScheme,
        defaultTheme,
        value,
        attrs,
        nonce,
    }) {
        console.log("\n== themeScript ==\n");
        const defaultSystem = defaultTheme === "system";

        // Code-golfing the amount of characters in the script
        const optimization = (() => {
            if (attribute === "class") {
                const removeClasses = `c.remove(${attrs.map((t) => `'${t}'`).join(",")})`;

                return `var rootHTML=document.documentElement,c=rootHTML.classList;${removeClasses};`;
            } else {
                return `var rootHTML=document.documentElement,n='${attribute}',s='setAttribute';`;
            }
        })();

        const fallbackColorScheme = (() => {
            console.log("\n== fallbackColorScheme ==\n");
            if (!enableColorScheme) {
                return "";
            }

            const fallback = colorSchemes.includes(defaultTheme) ? defaultTheme : null;

            if (fallback) {
                return `if(e==='light'||e==='dark'||!e)rootHTML.style.colorScheme=e||'${defaultTheme}'`;
            } else {
                return `if(e==='light'||e==='dark')rootHTML.style.colorScheme=e`;
            }
        })();

        const updateDOM = (name, literal = false, setColorScheme = true) => {
            console.log("\n== updateDOM ==\n");
            const resolvedName = value ? value[name] : name;
            const val = literal ? name + `|| ''` : `'${resolvedName}'`;
            let text = "";

            // MUCH faster to set colorScheme alongside HTML attribute/class
            // as it only incurs 1 style recalculation rather than 2
            // This can save over 250ms of work for pages with big DOM
            if (enableColorScheme && setColorScheme && !literal && colorSchemes.includes(name)) {
                text += `rootHTML.style.colorScheme = '${name}';`;
            }

            if (attribute === "class") {
                if (literal || resolvedName) {
                    text += `c.add(${val})`;
                } else {
                    text += `null`;
                }
            } else {
                if (resolvedName) {
                    text += `rootHTML[s](n,${val})`;
                }
            }

            return text;
        };

        const scriptSrc = (() => {
            console.log("\n== scriptSrc ==\n");
            if (forcedTheme) {
                console.log("// forcedTheme");
                return `!function(){${optimization}${updateDOM(forcedTheme)}}()`;
            }

            if (enableSystem) {
                console.log("// enableSystem");

                return `!function(){try{${optimization}var e=localStorage.getItem('${storageKey}');if('system'===e||(!e&&${defaultSystem})){var t='${MEDIA}',m=window.matchMedia(t);if(m.media!==t||m.matches){${updateDOM(
                    "dark",
                )}}else{${updateDOM("light")}}}else if(e){${
                    value ? `var x=${JSON.stringify(value)};` : ""
                }${updateDOM(value ? `x[e]` : "e", true)}}${
                    !defaultSystem ? `else{` + updateDOM(defaultTheme, false, false) + "}" : ""
                }${fallbackColorScheme}}catch(e){}}()`;
            }
            /* 
            !function(){
                try{
                    ${optimization}
                    var localTheme=localStorage.getItem('${storageKey}');
                    if('system' === localTheme || (!localTheme && ${defaultSystem}))
                    {
                        var t ='${MEDIA}', m = window.matchMedia(t);
                        if(m.media !== t || m.matches)
                        {
                            ${updateDOM("dark",)}
                        }
                        else
                        {
                            ${updateDOM("light")}
                        }
                    }
                    else if (localTheme)
                    {
                        ${value ? `var x=${JSON.stringify(value)};` : ""}
                        ${updateDOM(value ? `x[localTheme]` : "localTheme", true)}}
                        ${!defaultSystem ? `else{` + updateDOM(defaultTheme, false, false) + "}" : ""}
                        ${fallbackColorScheme}}catch(localTheme){}}()`
            */

            return `!function(){try{${optimization}var e=localStorage.getItem('${storageKey}');if(e){${
                value ? `var x=${JSON.stringify(value)};` : ""
            }${updateDOM(value ? `x[e]` : "e", true)}}else{${updateDOM(
                defaultTheme,
                false,
                false,
            )};}${fallbackColorScheme}}catch(t){}}();`;
        })();

        return (
            <script
                //     nonce={nonce}
                dangerouslySetInnerHTML={{ __html: scriptSrc }}
            />
            // <script nonce={nonce}>{scriptSrc}</script>
        );
    },
    // Never re-render this component
    () => true,
);
!(function () {
    try {
        var rootHTML = document.documentElement,
            n = "data-theme",
            s = "setAttribute";

        var e = localStorage.getItem("theme");

        if ("system" === e || (!e && true)) {
            var t = "(prefers-color-scheme: dark)",
                m = window.matchMedia(t);

            if (m.media !== t || m.matches) {
                rootHTML.style.colorScheme = "dark";
                rootHTML[s](n, "dark");
            } else {
                rootHTML.style.colorScheme = "light";
                rootHTML[s](n, "light");
            }
        } else if (e) {
            rootHTML[s](n, e || "");
        }
        if (e === "light" || e === "dark") rootHTML.style.colorScheme = e;
    } catch (e) {}
})();

!(function () {
    let localTheme = localStorage.getItem("theme");
    console.log(localTheme);
    if (localTheme === "system") {
        const prefersDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        console.log(window.matchMedia("(prefers-color-scheme: dark)"));
        let theme = "light";
        if (prefersDarkTheme) {
            theme = "dark";
        }
        document.documentElement.setAttribute("data-theme", theme);
    }
})();

// Helpers
const getTheme = (key, fallback) => {
    if (isServer) return undefined;
    let theme;
    try {
        theme = localStorage.getItem(key) || undefined;
    } catch (e) {
        // Unsupported
    }
    return theme || fallback;
};

const disableAnimation = () => {
    const css = document.createElement("style");
    css.appendChild(
        document.createTextNode(
            `*{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`,
        ),
    );
    document.head.appendChild(css);

    return () => {
        // Force restyle
        (() => window.getComputedStyle(document.body))();

        // Wait for next tick before removing
        setTimeout(() => {
            document.head.removeChild(css);
        }, 1);
    };
};

const getSystemTheme = (e) => {
    if (!e) e = window.matchMedia(MEDIA);
    const isDark = e.matches;
    const systemTheme = isDark ? "dark" : "light";
    return systemTheme;
};

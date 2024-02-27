"use client";
import React from "react";
import { useTheme } from "../ThemeProvider/ThemeProvider";

function ThemeToggle({}) {
    const { theme, setTheme } = useTheme();

    return (
        <div>
            <button
                className=''
                onClick={() => {
                    console.log("Change to Light Theme");
                    setTheme("light");
                }}>
                Light
            </button>
            <button
                className=''
                onClick={() => {
                    console.log("Change to Dark Theme");
                    setTheme("dark");
                }}>
                Dark
            </button>
            <button
                className=''
                onClick={() => {
                    console.log("Change to System Theme");
                    setTheme("system");
                }}>
                system
            </button>
        </div>
    );
}

export default ThemeToggle;

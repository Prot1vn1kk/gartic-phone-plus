// ==UserScript==
// @name         Gartic Phone Plus
// @namespace    https://github.com/Prot1vn1kk
// @version      1.0.0
// @description  Расширенное рисование, референсы, таймлапс-плеер и настройки для Gartic Phone. Один скрипт, без внешнего кода и аналитики.
// @author       Prot1vn1kk
// @license      MIT
// @homepageURL  https://github.com/Prot1vn1kk/gartic-phone-plus
// @supportURL   https://github.com/Prot1vn1kk/gartic-phone-plus/issues
// @downloadURL  https://raw.githubusercontent.com/Prot1vn1kk/gartic-phone-plus/main/dist/gartic-phone-plus.user.js
// @updateURL    https://raw.githubusercontent.com/Prot1vn1kk/gartic-phone-plus/main/dist/gartic-phone-plus.user.js
// @match        https://garticphone.com/*
// @run-at       document-start
// @noframes
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      commons.wikimedia.org
// @connect      api.openverse.org
// @icon         https://www.google.com/s2/favicons?sz=64&domain=garticphone.com
// ==/UserScript==

// Сеть нужна только модулю «Референсы»: поиск картинок через открытые API Wikimedia Commons и Openverse.
// Скрипт не подгружает внешний код, не собирает аналитику и не отправляет ваши данные на сторонние серверы.

(function () {
'use strict';

const W = unsafeWindow;
if (W.top !== W || W.__gpPlusLoaded) return;
W.__gpPlusLoaded = true;


(function () {

    var gateUrl = "http://127.0.0.1:38080";
    var gateOrigin = new URL(gateUrl).origin;
    var iframeId = "cpw" + (new Date().getTime()).toString();
    var iframe = null;
    var subscribed = false;
    var active = null;

    function isFunction(functionToCheck) {
        return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
    }

    function warning() {
        if (window.console && window.console.warn) {
            window.console.warn.apply(window.console, arguments);
        }
    }

    function joinPath() {

        var url = arguments[0];

        if (typeof (url) !== "object" || !(url instanceof URL)) {
            url = new URL(url);
        }

        var parts = Array.prototype.slice.call(arguments);
        parts.shift();

        var result = [];

        result = result.concat(url.pathname.split("/").filter(t => !!t));
        for (var i = 0; i < parts.length; i++) {
            result = result.concat(parts[i].split("/").filter(t => !!t))
        }

        url.pathname = result.join("/");

        return url;
    }

    function isLoadedFromOrigin() {
        var locationFull = joinPath(gateUrl, "widget.js").toString();
        var locationMin = joinPath(gateUrl, "widget.min.js").toString();

        var loadedCorrectly = false;

        var scriptTags = window.document.getElementsByTagName('script');
        for (var i = 0; i < scriptTags.length; i++) {
            var tag = scriptTags[i];
            if (tag.outerHTML && tag.outerHTML.indexOf &&
                ((tag.outerHTML.indexOf(locationFull) !== -1) ||
                    (tag.outerHTML.indexOf(locationMin) !== -1))) {
                loadedCorrectly = true;
            }
        }

        return loadedCorrectly;
    }

    window.addEventListener('load', function load() {
        if(!isLoadedFromOrigin()) {
            var location = joinPath(gateUrl, "widget.min.js").toString();
            warning("widget.js: It looks like you may be loading CryptoPay widget.js in an unconvential way. We highly recommend that you load widget.js by adding \'<script src=\"" + location + 
            "></script>\' to your webpage. This will ensure that you get access to new features and product updates as they become available.");
        }
        window.removeEventListener('load', load);
    });

    function subscribe() {

        if (subscribed) {
            return;
        }

        window.addEventListener('message', onMessage, false);
    }

    function getIFrame() {

        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.setAttribute('allowtransparency', 'true');
            iframe.style.display = 'none';
            iframe.style.border = 0;
            iframe.style.position = 'fixed';
            iframe.style.top = 0;
            iframe.style.left = 0;
            iframe.style.height = '100%';
            iframe.style.width = '100%';
            iframe.style.zIndex = '2147483647';
            iframe.id = iframeId;
        }

        return iframe;
    }

    function openWidget(widget) {

        var iframe = getIFrame();

        if (active && iframe.style.display !== 'none') {
            if (active.gatewayId !== widget.gatewayId || active.orderId !== widget.orderId) {
                throw Error("Widget already open for order '" + widget.orderId + "', and gateway '" + widget.gatewayId + "'.");
            } else {
                warning("widget.js: Widget already open for order '" + widget.orderId + "', and gateway '" + widget.gatewayId + "'.");
                return;
            }
        }

        active = widget;
        subscribe();

        console.log(`Allowed ${active.gatewayId}, ${active.orderId}`);
        var url = widgetUrl(active.gatewayId, active.orderId).toString();
        iframe.src = url;
        if (!document.getElementById(iframe.id)) {
            window.document.body.appendChild(iframe);
        }
    }

    function closeWidget(data) {
        hideFrame(data);
    }

    function showFrame() {

        document.body.style.overflow = 'hidden';
        var iframe = getIFrame()

        iframe.style.display = 'block';
        if (active && active.handlers.onEnter) {
            try {
                active.handlers.onEnter({
                    orderId: active.orderId
                });
            } catch (e) {
                warning("widget.js: An error was caught in onEnter handler for order '" + active.orderId + "'.", e);
            }
        }

    }

    function hideFrame(data) {

        if(!active) {
            return;
        }

        var temp = active;
        active = null;

        var iframe = getIFrame();

        iframe.style.display = 'none';
        window.document.body.removeChild(iframe);
        document.body.style.overflow = 'auto';

        if (temp && temp.handlers.onEnter) {

            if (!data) {
                data = {
                    orderId: temp.orderId,
                    wasConfirmed: false
                }
            }

            try {
                temp.handlers.onLeave(data);
            } catch (e) {
                warning("widget.js: An error was caught in onLeave handler for order '" + active.orderId + "'.", e);
            }
        }
    }

    function onMessage(event) {
        if (gateOrigin !== event.origin) {
            return;
        }

        var data = event.data;

        if (data.type === "LOADED") {
            showFrame();
            return;
        }

        if (data.type === "WRITE_TO_CLIPBOARD") {
            if (data.content) {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(data.content);
                } else {
                    warning("widget.js: Access to clipboard is forbidden.");
                }
            }
            return;
        }

        if (data.type === "HIDE") {
            closeWidget({
                orderId: data.orderId,
                wasConfirmed: data.wasConfirmed
            });
            return;
        }
    }

    function widgetUrl(gatewayId, orderId) {
        return joinPath(gateUrl, gatewayId, orderId);
    }

    function createWidget(gatewayId, options) {

        if (!gatewayId) {
            throw new Error("gatewayId is required and should not be empty string.");
        }

        if (options && options.onEnter) {
            if (!isFunction(options.onEnter)) {
                throw new Error("options.onEnter should be a function.");
            }
        }

        if (options && options.onLeave) {
            if (!isFunction(options.onLeave)) {
                throw new Error("options.onLeave should be a function.");
            }
        }

        function show(orderId) {

            var widget = {
                gatewayId: gatewayId,
                orderId: orderId,
                handlers: {
                    onEnter: options && options.onEnter ? options.onEnter : undefined,
                    onLeave: options && options.onLeave ? options.onLeave : undefined
                }
            }

            openWidget(widget);
        }

        function hide() {
            closeWidget();
        }

        return {
            show: show,
            hide: hide
        }
    }

    if (window.CryptoPay === undefined) {
        window.CryptoPay = {};
    }
    window.CryptoPay.createWidget = createWidget;
})();

#include "windowhandler.h"
#include "../libs/loguru/src/loguru.hpp"
#include <X11/Xlib.h>
#include <stdexcept>

#define _NET_WM_STATE_ADD 1

std::string getWindowTitle(Display *display, Window window)
{
    Atom actualType, filterAtom;
    int actualFormat, status;
    unsigned long itemCount, bytesAfter;
    unsigned char *prop;

    filterAtom = XInternAtom(display, "_NET_WM_NAME", True);
    status = XGetWindowProperty(display, window, filterAtom, 0, 1000, False, AnyPropertyType,
                                &actualType, &actualFormat, &itemCount, &bytesAfter, &prop);

    if (status != Success)
    {
        throw std::runtime_error("Unable to get _NET_WM_NAME property of window. Status code: " + std::to_string(status));
    }

    if (prop == NULL || prop[0] == '\0')
    {
        return std::string();
    }

    std::string windowName(reinterpret_cast<char *>(prop));
    return windowName;
}

Window findWindowByTitlePrefix(Display *display, Window window, std::string titlePrefix)
{
    Window *children, dummy;
    unsigned int nchildren;
    unsigned int i;
    Window w = 0;
    std::string windowTitle;

    windowTitle = getWindowTitle(display, window);
    if (windowTitle.rfind(titlePrefix, 0) == 0) // if windowName.startsWith(name)
    {
        return (window);
    }

    if (!XQueryTree(display, window, &dummy, &dummy, &children, &nchildren))
    {
        return (0);
    }

    for (i = 0; i < nchildren; i++)
    {
        w = findWindowByTitlePrefix(display, children[i], titlePrefix);
        if (w)
        {
            break;
        }
    }
    if (children)
    {
        XFree((char *)children);
    }

    return (w);
}

void sendXEventSkipTaskbar(Display *display, Window window)
{
    XEvent event;
    event.xclient.type = ClientMessage;
    event.xclient.serial = 0;
    event.xclient.send_event = True;
    event.xclient.display = display;
    event.xclient.window = window;
    event.xclient.message_type = XInternAtom(display, "_NET_WM_STATE", False);
    event.xclient.format = 32;

    event.xclient.data.l[0] = _NET_WM_STATE_ADD;
    event.xclient.data.l[1] = XInternAtom(display, "_NET_WM_STATE_SKIP_TASKBAR", False);

    XSendEvent(display, DefaultRootWindow(display), False,
               SubstructureRedirectMask | SubstructureNotifyMask, &event);
}

void throwIfNotFoundOrLog(Window window, std::string windowTitlePrefix)
{
    if (!window)
    {
        throw std::runtime_error("Unable to find window with title prefix \"" + windowTitlePrefix + "\"");
    }
    else
    {
        LOG_F(INFO, "Window found: %p", &window);
    }
}

void setAsModelessDialog(std::string windowTitlePrefix, std::string ownerWindowTitlePrefix)
{
    Display *display = XOpenDisplay(NULL);
    if (!display)
    {
        throw std::runtime_error("Unable to open display");
    }

    Window rootWindow = DefaultRootWindow(display);
    if (!rootWindow)
    {
        throw std::runtime_error("Unable to get root window");
    }

    Window window = findWindowByTitlePrefix(display, rootWindow, windowTitlePrefix);
    Window ownerWindow = findWindowByTitlePrefix(display, rootWindow, ownerWindowTitlePrefix);

    throwIfNotFoundOrLog(window, windowTitlePrefix);
    throwIfNotFoundOrLog(ownerWindow, ownerWindowTitlePrefix);

    XSetTransientForHint(display, window, ownerWindow);
    sendXEventSkipTaskbar(display, window);

    XFlush(display);
    XCloseDisplay(display);
}

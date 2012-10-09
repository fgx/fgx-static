The FGX Static Content

This is a check out of git.fgx.ch:fgx-static
and is served by nginx as static.fgx.ch (also cdn.fgx.ch for legacy)

the GIT contains the static stuff to be served.


IMPORTANT:
Parts of this stuff is gonna be cached forever.. later with cached headers..

so style sheets and icons are names with *.1.* *.2.*
eg mystyle.1.css then mystyle.2.css etc

we will work this out in due course..

//===================
To change icons

instead of replacing the icon, create a parellel directory and images
will allow for theming..

and adjust the style sheet..
icons.css WHICH IS NOT CACHED>.

//===============================
Notable content..

fgx/ 
> is the fgx logos..

_/
>  is the html5reset stuff (maybe later a git external)

js/ext*
> is the extjs toolkit


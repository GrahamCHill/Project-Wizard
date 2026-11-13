#!/bin/sh
set -eu

if [ "$#" -lt 1 ] || [ ! -f "$1" ] || [ ! -x "$1" ]; then
    echo "Usage: sh $0 path/to/executable [arguments ...]" >&2
    exit 1
fi

data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}
asset_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../assets" && pwd -P)
id=app-__PROJECT_SLUG__
icons="$data_home/icons/hicolor/256x256/apps"
applications="$data_home/applications"
mkdir -p -- "$icons" "$applications"
cp -- "$asset_dir/app.png" "$icons/$id.png"

case "$1" in
    /*) ;;
    *) executable="$PWD/$1"; shift; set -- "$executable" "$@" ;;
esac

# Desktop Entry quoting has two escape passes and treats percent signs as field codes.
quote_argument() {
    printf '"'
    printf '%s' "$1" | sed -e 's/\\/\\\\\\\\/g' -e 's/["$`]/\\\\&/g' -e 's/%/%%/g'
    printf '"'
}

{
    printf '%s\n' '[Desktop Entry]' 'Type=Application' 'Name=__PROJECT_NAME__' "Icon=$id" 'Terminal=false'
    printf 'Exec='
    quote_argument "$1"
    shift
    for argument do
        printf ' '
        quote_argument "$argument"
    done
    printf '\n'
} > "$applications/$id.desktop"

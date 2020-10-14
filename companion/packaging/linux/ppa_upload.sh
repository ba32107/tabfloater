#!/bin/bash

set -e

export DEBFULLNAME="Balazs Gyurak"
export DEBEMAIL="balazs@tabfloater.io"
_PPA_HOST="ppa:ba32107/tabfloater"
_SERIES_LIST="focal"

_COMPANION_DIR=$(git rev-parse --show-toplevel)/companion
_PPA_RESOURCES_DIR=$_COMPANION_DIR/packaging/linux/ubuntu-ppa
_BUILD_DIR=$_COMPANION_DIR/dist
_PPA_BUILD_DIR=$_COMPANION_DIR/dist_ppa
_STAGE_COUNTER=1
_DRY_RUN=""
_CLEAN_ONLY=""

function print_usage() {
    echo
    echo "Builds TabFloater Companion DEB source packages and uploads to Launchpad."
    echo
    echo "Usage: $0 [options]"
    echo
    echo "Options:"
    echo "  -c   --clean      Cleans up build files and directories"
    echo "  -d   --dry-run    Build the packages, but only simulate upload"
    echo "  -h   --help       Displays this information"
    echo "  -s   --series     Comma-separated Ubuntu series to upload for (default: \"$_SERIES_LIST\")"
    echo
    exit
}

function print_stage() {
    local _stage=$1
    echo
    echo "*** $_STAGE_COUNTER. $_stage ***"
    ((_STAGE_COUNTER++))
    echo
}

function print_step() {
    local _step=$1
    echo
    echo "--- $_step"
    echo
}

function clean() {
    rm -rf $_BUILD_DIR
    rm -rf $_PPA_BUILD_DIR
}

function build_deb_source_package() {
    local _series=$1
    print_step "Building for $_series"

    cd $_PPA_BUILD_DIR
    mkdir $_series && cd $_series

    tar -xzf $_TARBALL
    cd $(basename $_TARBALL .tar.gz)

    cp -r $_PPA_RESOURCES_DIR/* .
    sed -i "s/SERIES/$_series/g" ./debian/changelog

    debuild --no-tgz-check -S
}

function upload_to_launchpad() {
    local _series=$1
    local _simulate_option=""

    if [ "$_DRY_RUN" = true ]; then
        _simulate_option="-s"
    fi

    print_step "Uploading for $_series"

    cd $_PPA_BUILD_DIR/$_series
    local _changes_file=$(ls ./*.changes)

    dput -lo $_changes_file
    dput $_simulate_option $_PPA_HOST $_changes_file
}


while [ $# -ge 1 ]; do
    _arg="$1"
    case "$_arg" in
        -c|--clean)
            _CLEAN_ONLY=true ;;
        -d|--dry-run)
            _DRY_RUN=true ;;
        -h|--help)
            print_usage
            exit ;;
        -s|--series)
            _SERIES_LIST=$2
            shift ;;
        *)
            echo "Error: uknown option: $_arg"
            print_usage
            exit 1 ;;
    esac
    shift
done

clean

if [ "$_CLEAN_ONLY" = true ]; then
    echo "Cleaned up build directories"
    exit
fi

print_stage "Build upstream tarball"

cd $_COMPANION_DIR
cmake -S . -B $_BUILD_DIR
cmake --build $_BUILD_DIR --target package_source

_TARBALL=$(ls $_BUILD_DIR/*.tar.gz)

mkdir $_PPA_BUILD_DIR

print_stage "Building source packages"

for _series in $(echo $_SERIES_LIST | sed "s/,/ /g")
do
    build_deb_source_package $_series
done

print_stage "Uploading to Launchpad ${_DRY_RUN:+-- DRY RUN}"

for _series in $(echo $_SERIES_LIST | sed "s/,/ /g")
do
    upload_to_launchpad $_series
done
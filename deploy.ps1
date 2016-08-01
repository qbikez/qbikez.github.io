pushd
try {
    cd _site
    git add .
    git commit -m "update posts"
    git push
} finally {
    popd
}
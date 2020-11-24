module.exports = function ({ owner, gh }) {
    return async function sync_settings(repo) {
        console.log(`[RUN] syncing settings for ${repo.name}`)

        let settings_updated = true

        try {
            const resp = await gh.request('PATCH /repos/{owner}/{repo}', {
                owner,
                repo: repo.name,
                has_projects: false,
                has_issues: true,
                has_wiki: false,
                allow_squash_merge: true,
                allow_merge_commit: true,
                allow_rebase_merge: true,
                delete_branch_on_merge: true,
            })

            if (resp.status === 200) {
                console.info(`[OK] settings for ${owner}/${repo.name} updated successfully`)
            } else {
                console.warn(`[WARN] settings for ${owner}/${repo.name} update failed`)
                settings_updated = false
            }
        } catch (error) {
            console.error(error)
        }

        return {
            ...repo,
            settings_updated,
        }
    }
}

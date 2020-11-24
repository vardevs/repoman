module.exports = function ({ gh, owner, secrets }) {
    return async function sync_org_secrets (repo) {
        console.log(`[RUN] syncing org secrets for ${repo.name}`)

        let org_secrets_updated = true

        for (const secret of secrets) {
            try {
                const resp = await gh.request('PUT /orgs/{owner}/actions/secrets/{secret_name}/repositories/{repo_id}', {
                    owner,
                    repo_id: repo.id,
                    secret_name: secret,
                })

                if (resp.status >= 200 && resp.status < 300) {
                    console.info(`[OK] syncing org secret ${secret} for ${owner}/${repo.name} updated successfully`)
                } else {
                    console.warn(`[WARN] org secret ${secret} for ${owner}/${repo.name} update failed`)
                    org_secrets_updated = false
                }
            } catch (error) {
                console.error(error)
                org_secrets_updated = false
            }
        }

        return {
            ...repo,
            org_secrets_updated,
        }
    }
}

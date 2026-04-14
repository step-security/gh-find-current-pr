import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import axios, { isAxiosError } from 'axios';

async function validateSubscription(): Promise<void> {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    let repoPrivate: boolean | undefined;

    if (eventPath && fs.existsSync(eventPath)) {
        const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
        repoPrivate = eventData?.repository?.private;
    }

    const upstream = 'jwalton/gh-find-current-pr';
    const action = process.env.GITHUB_ACTION_REPOSITORY;
    const docsUrl = 'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions';

    core.info('');
    core.info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m');
    core.info(`Secure drop-in replacement for ${upstream}`);
    if (repoPrivate === false) core.info('\u001b[32m\u2713 Free for public repositories\u001b[0m');
    core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
    core.info('');

    if (repoPrivate === false) return;

    const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
    const body: Record<string, string> = { action: action || '' };
    if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl;
    try {
        await axios.post(
            `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
            body,
            { timeout: 3000 }
        );
    } catch (error) {
        if (isAxiosError(error) && error.response?.status === 403) {
            core.error(
                `\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`
            );
            core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
            process.exit(1);
        }
        core.info('Timeout or API not reachable. Continuing to next step.');
    }
}

async function main() {
    await validateSubscription();
    const token = core.getInput('github-token', { required: false }) || process.env.GITHUB_TOKEN;
    const state = (core.getInput('state', { required: false }) || 'open').toLowerCase();
    const sha = core.getInput('sha', { required: true });

    if (!token) {
        throw new Error('No GITHUB_TOKEN found');
    }

    const octokit = github.getOctokit(token);
    const context = github.context;
    const result = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        commit_sha: sha,
    });

    const prs = result.data.filter((el) => state === 'all' || el.state === state);
    const pr =
        prs.find((el) => {
            return context.payload.ref === `refs/heads/${el.head.ref}`;
        }) || prs[0];

    core.info(`Setting output: draft: ${(pr && pr.draft) || ''}`);
    core.setOutput('draft', (pr && pr.draft) || '');
    core.info(`Setting output: pr: ${(pr && pr.number) || ''}`);
    core.setOutput('pr', (pr && pr.number) || '');
    core.info(`Setting output: number: ${(pr && pr.number) || ''}`);
    core.setOutput('number', (pr && pr.number) || '');
    core.info(`Setting output: title: ${(pr && pr.title) || ''}`);
    core.setOutput('title', (pr && pr.title) || '');
    core.setOutput('body', (pr && pr.body) || '');
}

main().catch((err) => core.setFailed(err.message));

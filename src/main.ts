import * as core from '@actions/core';
import * as github from '@actions/github';
import axios, { isAxiosError } from 'axios';

async function validateSubscription(): Promise<void> {
    const API_URL = `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/subscription`;

    try {
        await axios.get(API_URL, { timeout: 3000 });
    } catch (error) {
        if (isAxiosError(error) && error.response?.status === 403) {
            core.error('Subscription is not valid. Reach out to support@stepsecurity.io');
            process.exit(1);
        } else {
            core.info('Timeout or API not reachable. Continuing to next step.');
        }
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

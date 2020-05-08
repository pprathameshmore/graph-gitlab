import fetch, { RequestInit, Response } from 'node-fetch';
import {
  GitLabUser,
  GitLabGroup,
  GitLabProject,
  GitLabMergeRequest,
  GitLabUserRef,
  GitLabMergeRequestApproval,
} from './types';

export enum HttpMethod {
  GET = 'get',
  POST = 'post',
}

export class GitlabClient {
  private readonly baseUrl: string;
  private readonly personalToken: string;

  constructor(baseUrl: string, personalToken: string) {
    this.baseUrl = baseUrl;
    this.personalToken = personalToken;
  }

  async fetchAccount(): Promise<GitLabUser> {
    return this.makeSingularRequest(HttpMethod.GET, '/user');
  }

  async fetchUser(id: number): Promise<GitLabUser> {
    return this.makeSingularRequest(HttpMethod.GET, `/users/${id}`);
  }

  async fetchGroups(): Promise<GitLabGroup[]> {
    return this.makePaginatedRequest(HttpMethod.GET, '/groups');
  }

  async fetchProjects(): Promise<GitLabProject[]> {
    return this.makePaginatedRequest(HttpMethod.GET, '/projects', null, {
      owned: true,
    });
  }

  async fetchUsers(): Promise<GitLabUser[]> {
    return this.makePaginatedRequest(HttpMethod.GET, '/users');
  }

  async fetchProjectMergeRequests(
    projectId: number,
  ): Promise<GitLabMergeRequest[]> {
    return this.makePaginatedRequest(
      HttpMethod.GET,
      `/projects/${projectId}/merge_requests`,
      1,
    );
  }

  async fetchMergeRequestApprovals(
    projectId: number,
    mergeRequestId: number,
  ): Promise<GitLabMergeRequestApproval> {
    const x: any = await this.makeRequest(
      HttpMethod.GET,
      `/projects/${projectId}/merge_requests/${mergeRequestId}/approvals`,
    );
    return x;
  }

  async fetchProjectMembers(projectId: number): Promise<GitLabUserRef[]> {
    return this.makePaginatedRequest(
      HttpMethod.GET,
      `/projects/${projectId}/members/all`,
    );
  }

  async fetchGroupMembers(groupId: number): Promise<GitLabUserRef[]> {
    return this.makePaginatedRequest(
      HttpMethod.GET,
      `/groups/${groupId}/members/all`,
    );
  }

  async fetchGroupProjects(groupId: number): Promise<GitLabProject[]> {
    return this.makePaginatedRequest(
      HttpMethod.GET,
      `/groups/${groupId}/projects`,
    );
  }

  async fetchGroupSubgroups(groupId: number): Promise<GitLabGroup[]> {
    return this.makePaginatedRequest(
      HttpMethod.GET,
      `/groups/${groupId}/subgroups`,
    );
  }

  private async makeRequest(
    method: HttpMethod,
    url: string,
  ): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        'Private-Token': this.personalToken,
      },
    };

    const response: Response = await fetch(
      `${this.baseUrl}/api/v4${url}`,
      options,
    );

    if (!response) {
      throw new Error(`No response from '${this.baseUrl}/api/v4${url}'`);
    }

    if (!response.status.toString().startsWith('2')) {
      throw new Error(`No response from '${this.baseUrl}/api/v4${url}'`);
    }

    return response;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const responseBody: string = await response.text();

    return responseBody.length > 0 &&
      response.headers.get('content-type').match(/json/i)
      ? JSON.parse(responseBody)
      : null;
  }

  private async makeSingularRequest<T>(
    method: HttpMethod,
    url: string,
  ): Promise<T> {
    const response = await this.makeRequest(method, `${url}`);

    return this.parseResponse<T>(response);
  }

  private async makePaginatedRequest<T>(
    method: HttpMethod,
    url: string,
    maxPages?: number,
    params?: {},
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 0;
    let totalPages = 1;
    let pageLimit = maxPages || Number.POSITIVE_INFINITY;

    do {
      const queryParams = Object.entries(params || {})
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      const response = await this.makeRequest(
        method,
        `${url}?page=${++page}&per_page=1${
          queryParams ? '&' + queryParams : ''
        }`,
      );

      totalPages = parseInt(response.headers.get('X-Total-Pages'), 10);

      const result = await this.parseResponse<T>(response);

      if (result) {
        results.push(result);
      }
    } while (page < totalPages && page < pageLimit);

    return [].concat(...results);
  }
}

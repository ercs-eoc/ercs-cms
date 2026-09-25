/* eslint-disable @typescript-eslint/no-unused-vars */
import { gql } from 'urql';

const CAPACITY_AND_RESOURCES = gql`
    query CapacityAndResources($pagination: OffsetPaginationInput, $filters: CapacityAndResourceFilter) {
        capacityAndResources(pagination: $pagination, filters: $filters) {
            results {
                createdAt
                description
                id
                dashboardsCount
                isActive
                order
                title
                updatedAt
            }
            totalCount
        }
    }
`;

const DELETE_CAPACITY_AND_RESOURCE = gql`
    mutation DeleteCapacityAndResource($id: ID!) {
        deleteCapacityAndResource(id: $id) {
            errors
            ok
        }
    }
`;

const CAPACITY_AND_RESOURCE_DETAIL = gql`
    query CapacityAndResourceDetail($id: ID!) {
        capacityAndResource(id: $id) {
            id
            description
            isActive
            order
            title
        }
    }
`;

const CREATE_CAPACITY_AND_RESOURCE = gql`
    mutation CreateCapacityAndResource($data: CapacityAndResourceCreateInput!) {
        createCapacityAndResource(data: $data) {
            ... on CapacityAndResourceTypeMutationResponseType {
                errors
                ok
                result {
                    id
                }
            }
        }
    }
`;

const UPDATE_CAPACITY_AND_RESOURCE = gql`
    mutation UpdateCapacityAndResource($id: ID!, $data: CapacityAndResourceUpdateInput!) {
        updateCapacityAndResource(id: $id, data: $data) {
            ... on CapacityAndResourceTypeMutationResponseType {
                errors
                ok
                result {
                    id
                }
            }
        }
    }
`;

const RESOURCE_DASHBOARDS = gql`
    query ResourceDashboards($pagination: OffsetPaginationInput, $filters: ExternalDashboardFilter, $ordering: [ExternalDashboardOrder!]) {
        externalDashboards(pagination: $pagination, filters: $filters, ordering: $ordering) {
            results {
                id
                title
                url
                page
                pageDisplay
                regionId
                capacityAndResourceId
                isActive
                order
                createdAt
                updatedAt
            }
            totalCount
        }
    }
`;

const DELETE_RESOURCE_DASHBOARD = gql`
    mutation DeleteResourceDashboard($id: ID!) {
        deleteExternalDashboard(id: $id) {
            errors
            ok
        }
    }
`;

const RESOURCE_DASHBOARD_DETAIL = gql`
    query ResourceDashboardDetail($id: ID!) {
        externalDashboard(id: $id) {
            id
            title
            url
            page
            description
            regionId
            capacityAndResourceId
            order
            isActive
            showOnHome
        }
    }
`;

const CREATE_RESOURCE_DASHBOARD = gql`
    mutation CreateResourceDashboard($data: ExternalDashboardCreateInput!) {
        createExternalDashboard(data: $data) {
            ... on ExternalDashboardTypeMutationResponseType {
                errors
                ok
                result {
                    id
                }
            }
        }
    }
`;

const UPDATE_RESOURCE_DASHBOARD = gql`
    mutation UpdateResourceDashboard($id: ID!, $data: ExternalDashboardUpdateInput!) {
        updateExternalDashboard(id: $id, data: $data) {
            ... on ExternalDashboardTypeMutationResponseType {
                errors
                ok
                result {
                    id
                }
            }
        }
    }
`;

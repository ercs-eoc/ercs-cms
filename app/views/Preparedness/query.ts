/* eslint-disable @typescript-eslint/no-unused-vars */
import { gql } from 'urql';

const EXTERNAL_DASHBOARDS = gql`
    query PreparednessExternalDashboards($pagination: OffsetPaginationInput, $filters: ExternalDashboardFilter, $ordering: [ExternalDashboardOrder!]) {
        externalDashboards(pagination: $pagination, filters: $filters, ordering: $ordering) {
            results {
                createdAt
                createdById
                description
                id
                isActive
                order
                page
                pageDisplay
                regionId
                title
                updatedAt
                url
            }
            totalCount
        }
    }
`;

const DELETE_EXTERNAL_DASHBOARD = gql`
    mutation PreparednessDeleteExternalDashboard($id: ID!) {
        deleteExternalDashboard(id: $id) {
            errors
            ok
        }
    }
`;

const EXTERNAL_DASHBOARD_DETAIL = gql`
    query PreparednessExternalDashboardDetail($id: ID!) {
        externalDashboard(id: $id) {
            id
            description
            isActive
            order
            page
            regionId
            showOnHome
            title
            url
        }
    }
`;

const CREATE_EXTERNAL_DASHBOARD = gql`
    mutation PreparednessCreateExternalDashboard($data: ExternalDashboardCreateInput!) {
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

const UPDATE_EXTERNAL_DASHBOARD = gql`
    mutation PreparednessUpdateExternalDashboard($id: ID!, $data: ExternalDashboardUpdateInput!) {
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

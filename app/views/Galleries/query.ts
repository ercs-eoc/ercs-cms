/* eslint-disable @typescript-eslint/no-unused-vars */
import { gql } from 'urql';

const GALLERY_ALBUMS = gql`
    query GalleryAlbumList(
        $filters: GalleryAlbumFilter,
        $offset: Int!,
        $limit: Int
    ) {
        galleryAlbums (
            filters: $filters,
            pagination: {
                offset: $offset,
                limit: $limit
            }
        ){
            totalCount
            results {
                id
                title
                updatedAt
                imagesCount
                createdAt
                createdBy {
                    id
                    fullName
                }
            }
        }
    }
`;

const GALLERY_ALBUM_DETAIL = gql`
    query GalleryAlbumDetail($id: ID!) {
        galleryAlbum(id: $id) {
            id
            title
        }
    }
`;

const GALLERY_IMAGES = gql`
    query GalleryImageList(
        $filters: GalleryImageFilter,
        $offset: Int!,
        $limit: Int
    ) {
        galleryImages (
            filters: $filters,
            ordering: [{ order: ASC }],
            pagination: {
                offset: $offset,
                limit: $limit
            }
        ){
            totalCount
            results {
                id
                albumId
                caption
                order
                image {
                    name
                    size
                    url
                }
            }
        }
    }
`;

const CREATE_GALLERY_IMAGE = gql`
    mutation CreateGalleryImage($data: GalleryImageCreateInput!) {
        createGalleryImage(data: $data) {
            ... on GalleryImageTypeMutationResponseType {
                errors
                ok
                result {
                    id
                }
            }
        }
    }
`;

const DELETE_GALLERY_IMAGE = gql`
    mutation DeleteGalleryImage($id: ID!) {
        deleteGalleryImage(id: $id) {
            errors
            ok
        }
    }
`;

const CREATE_GALLERY_ALBUM = gql`
    mutation CreateGalleryAlbum($data: GalleryAlbumCreateInput!) {
        createGalleryAlbum(data: $data) {
            ... on GalleryAlbumTypeMutationResponseType {
                errors
                ok
                result {
                    id
                }
            }
        }
    }
`;

const UPDATE_GALLERY_ALBUM = gql`
    mutation UpdateGalleryAlbum($id: ID!, $data: GalleryAlbumUpdateInput!) {
        updateGalleryAlbum(id: $id, data: $data) {
            ... on GalleryAlbumTypeMutationResponseType {
                errors
                ok
            }
        }
    }
`;

const DELETE_GALLERY_ALBUM = gql`
    mutation DeleteGalleryAlbum($id: ID!) {
        deleteGalleryAlbum(id: $id) {
            errors
            ok
        }
    }
`;

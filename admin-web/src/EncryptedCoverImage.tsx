import { Image, type ImageProps } from 'antd';
import { useEncryptedCover } from './encryptedCover';
export function EncryptedCoverImage({src,...props}:ImageProps){return <Image {...props} src={useEncryptedCover(src)}/>}
